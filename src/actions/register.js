const Promise = require('bluebird');
const Errors = require('common-errors');
const noop = require('lodash/noop');
const merge = require('lodash/merge');
const passThrough = require('lodash/constant');
const reduce = require('lodash/reduce');
const is = require('is');

// internal deps
const setMetadata = require('../utils/updateMetadata.js');
const scrypt = require('../utils/scrypt.js');
const redisKey = require('../utils/key.js');
const jwt = require('../utils/jwt.js');
const isDisposable = require('../utils/isDisposable.js');
const mxExists = require('../utils/mxExists.js');
const makeCaptchaCheck = require('../utils/checkCaptcha.js');
const userExists = require('../utils/userExists.js');
const aliasExists = require('../utils/aliasExists.js');
const assignAlias = require('./alias.js');
const checkLimits = require('../utils/checkIpLimits.js');
const { register: emailAutoPassword } = require('../utils/challenges/generateEmail.js');
const { register: phoneAutoPassword } = require('../utils/challenges/phone/sendSms');
const challenge = require('../utils/challenges/challenge.js');
const handlePipeline = require('../utils/pipelineError.js');
const {
  USERS_INDEX,
  USERS_DATA,
  USERS_ACTIVE_FLAG,
  USERS_CREATED_FIELD,
  USERS_USERNAME_FIELD,
  lockAlias,
  lockRegister,
  USERS_ACTION_INVITE,
  USERS_ACTION_ACTIVATE,
  CHALLENGE_TYPE_EMAIL,
  CHALLENGE_TYPE_PHONE,
  TOKEN_METADATA_FIELD_METADATA,
} = require('../constants.js');

// cached helpers
const hasOwnProperty = Object.prototype.hasOwnProperty;

// metadata merger
// comes in the format of audience.data
const mergeMetadata = (accumulator, value, prop) => {
  accumulator[prop] = merge(accumulator[prop] || {}, value);
  return accumulator;
};

function getAutoPassword(challengeType) {
  switch (challengeType) {
    case CHALLENGE_TYPE_EMAIL:
      return emailAutoPassword;
    case CHALLENGE_TYPE_PHONE:
      return phoneAutoPassword;
    default:
      throw new Errors.NotImplementedError(`Auto password for ${challengeType}`);
  }
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
 * @apiParam (Payload) {String} [challengeType="email"] - challenge type
 */
function registerUser(request) {
  const { redis, config, tokenManager } = this;
  const { deleteInactiveAccounts, captcha: captchaConfig, registrationLimits } = config;
  const { defaultAudience } = config.jwt;

  // request
  const params = request.params;
  const {
    activate,
    anyUsername,
    challengeType,
    inviteToken,
    ipaddress,
    password,
    skipChallenge,
    username,
  } = params;
  const alias = params.alias && params.alias.toLowerCase();
  const captcha = hasOwnProperty.call(params, 'captcha') ? params.captcha : false;
  const userDataKey = redisKey(username, USERS_DATA);
  const created = Date.now();
  const { [challengeType]: tokenOptions } = this.config.token;
  const autoPassword = getAutoPassword(challengeType);

  // inject default audience if it's not present
  const audience = params.audience === defaultAudience
    ? [params.audience]
    : [params.audience, defaultAudience];

  if (audience.length === 2 && !params.metadata && !inviteToken) {
    throw new Errors.HttpStatusError(400, 'non-default audience must be accompanied by non-empty metadata or inviteToken');
  }

  if (inviteToken && !activate) {
    throw new Errors.HttpStatusError(400, 'Account must be activated when using invite token');
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
  const verifyToken = () => tokenManager
    .verify(inviteToken, { erase: false, control })
    .then(token => {
      if (!token.isFirstVerification) {
        throw new Errors.HttpStatusError(400, 'Invitation has expired or already been used');
      }

      return token;
    })
    .get('metadata')
    .get(TOKEN_METADATA_FIELD_METADATA)
    .then(meta => reduce(meta, mergeMetadata, metadata));

  // acquire lock now!
  return promise
    .then(() => (
      // multi-lock if we need to acquire alias
      this.dlock.multi(lockRegister(username), alias && lockAlias(alias))
    ))
    .then(lock => (
      Promise
        .bind(this, username)

        // do verifications of DB state
        .tap(userExists)
        .throw(new Errors.HttpStatusError(409, `"${username}" already exists`))
        .catchReturn({ statusCode: 404 }, username)
        .tap(alias ? aliasExists(alias, true) : noop)

        // generate password hash
        .tap(inviteToken ? verifyToken : noop)
        .return(username)
        .then(password ? passThrough(password) : autoPassword)
        .then(ctx => (is.string(ctx) ? ctx : ctx.context.password))
        .then(scrypt.hash)

        // create user
        .then(hash => {
          const pipeline = redis.pipeline();

          // basic internal info
          pipeline.hmset(userDataKey, {
            password: hash,
            [USERS_CREATED_FIELD]: created,
            [USERS_ACTIVE_FLAG]: activate,
          });

          // WARNING: IF USER IS NOT VERIFIED WITHIN <deleteInactiveAccounts>
          // [by default 30] DAYS - IT WILL BE REMOVED FROM DATABASE
          if (!activate && deleteInactiveAccounts >= 0) {
            pipeline.expire(userDataKey, deleteInactiveAccounts);
          }

          return pipeline.exec().then(handlePipeline);
        })
        // passed metadata
        .return({
          username,
          audience,
          metadata: audience.map(metaAudience => ({
            $set: Object.assign(metadata[metaAudience] || {}, metaAudience === defaultAudience && {
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
          if (!activate) {
            return Promise
              .bind(this, [challengeType, {
                id: username,
                action: USERS_ACTION_ACTIVATE,
                ...tokenOptions,
              }])
              .spread(skipChallenge ? noop : challenge)
              .then(challengeResponse => {
                const response = { requiresActivation: true };
                const uid = challengeResponse ? challengeResponse.context.token.uid : null;

                if (uid) {
                  response.uid = uid;
                }

                return response;
              });
          }

          // perform instant activation
          return redis
            // internal username index
            .sadd(USERS_INDEX, username)
            // custom actions
            .bind(this)
            .return(['users:activate', username, params.audience])
            .spread(this.hook)
            // login & return JWT
            .return([username, params.audience])
            .spread(jwt.login);
        })
        .finally(() => {
          // don't wait for this to complete
          lock.release().reflect();
          return null;
        })
    ));
}

module.exports = registerUser;
