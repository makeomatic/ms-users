const Promise = require('bluebird');
const { HttpStatusError } = require('common-errors');

const set = require('lodash/set');
const noop = require('lodash/noop');
const merge = require('lodash/merge');
const reduce = require('lodash/reduce');
const constant = require('lodash/constant');

// internal deps
const setMetadata = require('../utils/updateMetadata');
const redisKey = require('../utils/key');
const jwt = require('../utils/jwt');
const isDisposable = require('../utils/isDisposable');
const mxExists = require('../utils/mxExists');
const makeCaptchaCheck = require('../utils/checkCaptcha');
const { getUserId } = require('../utils/userData');
const aliasExists = require('../utils/aliasExists');
const assignAlias = require('./alias');
const checkLimits = require('../utils/checkIpLimits');
const challenge = require('../utils/challenges/challenge');
const handlePipeline = require('../utils/pipelineError');
const hashPassword = require('../utils/register/password/hash');
const {
  USERS_REF,
  USERS_INDEX,
  USERS_SSO_TO_ID,
  USERS_DATA,
  USERS_USERNAME_TO_ID,
  USERS_ACTIVE_FLAG,
  USERS_ID_FIELD,
  USERS_CREATED_FIELD,
  USERS_USERNAME_FIELD,
  USERS_PASSWORD_FIELD,
  USERS_REFERRAL_FIELD,
  lockAlias,
  lockRegister,
  USERS_ACTION_INVITE,
  USERS_ACTION_ACTIVATE,
  CHALLENGE_TYPE_EMAIL,
  USERS_REFERRAL_INDEX,
  TOKEN_METADATA_FIELD_METADATA,
  ErrorConflictUserExists,
} = require('../constants');

// cached helpers
const { hasOwnProperty } = Object.prototype;
const retNull = constant(null);
const ErrorMalformedAudience = new HttpStatusError(400, 'non-default audience must be accompanied by non-empty metadata or inviteToken');
const ErrorMalformedInvite = new HttpStatusError(400, 'Account must be activated when using invite token');
const ErrorInvitationExpiredOrUsed = new HttpStatusError(400, 'Invitation has expired or already been used');
const ErrorMissing = { statusCode: 404 };

// metadata merger
// comes in the format of audience.data
const mergeMetadata = (accumulator, value, prop) => {
  accumulator[prop] = merge(accumulator[prop] || {}, value);
  return accumulator;
};

/**
 * Verifies that token has not be used before
 * @param  {Object}  token
 * @return {Object}
 */
function verifyRedisTokenResponse(token) {
  if (!token.isFirstVerification) {
    throw ErrorInvitationExpiredOrUsed;
  }

  return token;
}

/**
 * Token verification function, on top of it returns extra metadata
 * @return {Promise}
 */
function verifyToken() {
  return this
    .tokenManager
    .verify(this.inviteToken, { erase: false, control: this.control })
    .then(verifyRedisTokenResponse)
    .get('metadata')
    .get(TOKEN_METADATA_FIELD_METADATA)
    .then(meta => reduce(meta, mergeMetadata, this.metadata));
}

/**
 * Verifies if there is a referal stored for this user
 * @return {Promise}
 */
function verifyReferral() {
  const key = redisKey(USERS_REF, this.referral);
  return this.redis
    .get(key)
    .then((reference) => {
      if (!reference) {
        return null;
      }

      this.metadata[this.audience][USERS_REFERRAL_FIELD] = reference;
      return null;
    });
}

/**
 * Verifies if SSO token provided, injects decoded SSO profile to metadata
 * @return {Promise}
 */
function verifySSO() {
  const { sso, metadata, defaultAudience } = this;
  const { uid, provider, profile } = sso;

  return Promise
    .bind(this, uid)
    .then(getUserId)
    .throw(ErrorConflictUserExists)
    .catchReturn(ErrorMissing, true)
    .tap(() => set(metadata, [defaultAudience, provider], profile));
}

/**
 * Disposes of the lock
 * @return {Null}
 */
function lockDisposer(lock) {
  lock.release().reflect();
  return null;
}

/**
 * @api {amqp} <prefix>.register Create User
 * @apiVersion 1.0.0
 * @apiName RegisterUser
 * @apiGroup Users
 *
 * @apiDescription Provides ability to register users, with optional throttling, captcha checks & email verification.
 * Based on provided arguments either returns "OK" indicating that user needs to complete challenge or JWT token & user
 * object
 *
 * @apiParam (Payload) {String} username - currently only email is supported
 * @apiParam (Payload) {String} audience - will be used to write metadata to
 * @apiParam (Payload) {String{3..15}} [alias] - alias for username, user will be marked as public. Can only be used when `activate` is `true`
 * @apiParam (Payload) {String} [password] - will be hashed and stored if provided, otherwise generated and sent via email
 * @apiParam (Payload) {Object} [captcha] - google recaptcha container
 * @apiParam (Payload) {String} [captcha.response] - token passed from client to verify at google
 * @apiParam (Payload) {String} [captcha.remoteip] - ip for security check at google
 * @apiParam (Payload) {String} [captcha.secret] - shared secret between us and google
 * @apiParam (Payload) {Object} [metadata] - metadata to be saved into `audience` upon completing registration
 * @apiParam (Payload) {Boolean} [activate=true] - whether to activate the user instantly or not
 * @apiParam (Payload) {String} [ipaddress] - used for security logging
 * @apiParam (Payload) {Boolean} [skipChallenge=false] - if `activate` is `false` disables sending challenge
 * @apiParam (Payload) {Boolean} [skipPassword=false] - disable setting password
 * @apiParam (Payload) {String} [challengeType="email"] - challenge type
 * @apiParam (Payload) {String} [referral] - pass id/fingerprint of the client to see if it was stored before and associate with this account
 */
module.exports = function registerUser(request) {
  const {
    redis, config, tokenManager, flake,
  } = this;
  const { deleteInactiveAccounts, captcha: captchaConfig, registrationLimits } = config;
  const { defaultAudience } = config.jwt;
  const { token: ssoTokenOptions } = config.oauth;

  // request
  const { params } = request;
  const {
    activate,
    anyUsername,
    challengeType,
    inviteToken,
    ipaddress,
    password,
    skipChallenge,
    skipPassword,
    username,
    referral,
    sso,
  } = params;
  const userId = flake.next();
  // note: this is to preserve back-compatibility before sso was introduced
  // if sso is undefined abd activate is undefined, then it defaults to true,
  // otherwise it's true/false/undefined based on what's passed
  let shouldActivate = activate === undefined && sso === undefined ? true : activate;
  const alias = params.alias && params.alias.toLowerCase();
  const captcha = hasOwnProperty.call(params, 'captcha') ? params.captcha : false;
  const userDataKey = redisKey(userId, USERS_DATA);
  const created = Date.now();
  const { [challengeType]: tokenOptions } = this.config.token;

  // inject default audience if it's not present
  const audience = params.audience === defaultAudience
    ? [params.audience]
    : [params.audience, defaultAudience];

  if (audience.length === 2 && !params.metadata && !inviteToken) {
    throw ErrorMalformedAudience;
  }

  if (inviteToken && !shouldActivate) {
    throw ErrorMalformedInvite;
  }

  // cache metadata
  const metadata = {
    [params.audience]: params.metadata || {},
  };

  // 1. perform logic checks
  // 2. acquire registration lock
  // 3. create pipeline that adds all the user data into the system atomically to avoid failures

  let promise = Promise.bind(this, username);

  // optional captcha verification
  if (captcha) {
    promise = promise.tap(makeCaptchaCheck(redis, username, captcha, captchaConfig));
  }

  if (registrationLimits) {
    if (registrationLimits.noDisposable) {
      promise = promise.tap(isDisposable(username));
    }

    if (challengeType === CHALLENGE_TYPE_EMAIL && registrationLimits.checkMX) {
      promise = promise.tap(mxExists(username));
    }

    if (registrationLimits.ip && ipaddress) {
      promise = promise.tap(checkLimits(redis, registrationLimits, ipaddress));
    }
  }

  // we must ensure that token matches supplied ID
  // it can be overwritten by sending `anyUsername: true`
  const control = { action: USERS_ACTION_INVITE };
  if (!anyUsername) control.id = username;

  // lock acquisition
  const acquireLock = this.dlock
    .multi(lockRegister(username), alias && lockAlias(alias))
    .disposer(lockDisposer);

  // acquire lock now!
  return promise.then(() => Promise.using(acquireLock, () => (
    Promise
      .bind(this, username)

      // do verifications of DB state
      .tap(getUserId)
      .throw(ErrorConflictUserExists)
      .catchReturn(ErrorMissing, username)
      .tap(alias ? aliasExists(alias, true) : noop)

      // generate password hash
      .bind({
        redis,
        tokenManager,
        control,
        inviteToken,
        metadata,
        referral,
        sso,
        ssoTokenOptions,
        defaultAudience,
        audience: params.audience,
      })
      // verifies token and adds extra meta if this is present
      .tap(inviteToken ? verifyToken : noop)
      // if referral is set - verifies if it was previously saved
      .tap(referral ? verifyReferral : noop)
      // if sso is provided - decodes token and patches provided SSO object
      .tap(sso ? verifySSO : noop)
      // prepare next context
      .return([
        password,
        challengeType,
        username,
        // this will be passed as context if we need to send an email
        // effectively allowing us to get some meta like firstName and lastName
        // for personalized emails
        metadata[params.audience],
      ])
      .bind(this)
      .spread(skipPassword === false ? hashPassword : retNull)

      // create user
      .then((hash) => {
        const pipeline = redis.pipeline();
        const basicInfo = {
          [USERS_CREATED_FIELD]: created,
          [USERS_USERNAME_FIELD]: username,
        };

        if (sso) {
          const {
            provider, email, uid, credentials,
          } = sso;

          // skip activation if email is given by sso provider and equals to registered email
          if (shouldActivate === undefined) {
            shouldActivate = email ? username === email : false;
          }

          // inject sensitive provider info to internal data
          basicInfo[provider] = JSON.stringify(credentials.internals);

          // link uid to username
          pipeline.hset(USERS_SSO_TO_ID, uid, userId);
        }

        if (hash !== null) {
          basicInfo[USERS_PASSWORD_FIELD] = hash;
        }

        // if user is active
        basicInfo[USERS_ACTIVE_FLAG] = shouldActivate;
        // set internal data
        pipeline.hmset(userDataKey, basicInfo);
        // @TODO expire?
        pipeline.hset(USERS_USERNAME_TO_ID, username, userId);

        // WARNING: IF USER IS NOT VERIFIED WITHIN <deleteInactiveAccounts>
        // [by default 30] DAYS - IT WILL BE REMOVED FROM DATABASE
        if (!shouldActivate && deleteInactiveAccounts >= 0) {
          pipeline.expire(userDataKey, deleteInactiveAccounts);
        }

        return pipeline.exec().then(handlePipeline);
      })
      // passed metadata
      .return({
        userId,
        audience,
        metadata: audience.map(metaAudience => ({
          $set: Object.assign(metadata[metaAudience] || {}, metaAudience === defaultAudience && {
            [USERS_ID_FIELD]: userId,
            [USERS_USERNAME_FIELD]: username,
            [USERS_CREATED_FIELD]: created,
          }),
        })),
      })
      .then(setMetadata)
      // NOTE: alias: if present, if account is not activated - it will lock that alias
      // until it's manually cleaned from the DB somehow
      .return({ params: { username, alias, internal: true } })
      .then(alias ? assignAlias : noop)
      // activate user or queue challenge
      .then(() => {
        // Option 1. Activation
        if (!shouldActivate) {
          return Promise
            .bind(this, [
              challengeType,
              {
                id: username,
                action: USERS_ACTION_ACTIVATE,
                ...tokenOptions,
              },
              {
                ...metadata[params.audience],
              },
            ])
            .spread(skipChallenge ? noop : challenge) // eslint-disable-line promise/always-return
            .then((challengeResponse) => {
              const response = { requiresActivation: true, id: userId };
              const uid = challengeResponse ? challengeResponse.context.token.uid : null;

              if (uid) {
                response.uid = uid;
              }

              return response;
            });
        }

        // perform instant activation
        // internal username index
        const pipeline = redis.pipeline().sadd(USERS_INDEX, userId);
        const ref = metadata[params.audience][USERS_REFERRAL_FIELD];

        // add to referral index during registration
        // on instant activation
        if (ref) {
          pipeline.sadd(`${USERS_REFERRAL_INDEX}:${ref}`, userId);
        }

        return pipeline
          .exec()
          .then(handlePipeline)
          // custom actions
          .bind(this)
          .return(['users:activate', userId, params, metadata])
          .spread(this.hook)
          // login & return JWT
          .return([userId, params.audience])
          .spread(jwt.login);
      })
  )));
};

// transform `sso` token if it's present
module.exports.allowed = function transformSSO({ params }) {
  const { sso } = params;

  // if there is no sso - don't do anything
  if (sso === undefined) {
    return null;
  }

  // retrieve configuration options
  const ssoTokenOptions = this.config.oauth.token;

  // verify SSO token & rewrite params.sso
  return jwt
    .verifyData(sso, ssoTokenOptions)
    .then((credentials) => {
      const {
        uid, provider, email, profile,
      } = credentials;

      params.sso = {
        uid,
        provider,
        credentials,
        profile,
        email,
      };

      return null;
    });
};

// init transport
module.exports.transports = [require('@microfleet/core').ActionTransport.amqp];
