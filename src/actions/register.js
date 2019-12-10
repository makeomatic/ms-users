const Promise = require('bluebird');
const { ActionTransport } = require('@microfleet/core');
const { LockAcquisitionError } = require('ioredis-lock');
const { HttpStatusError } = require('common-errors');

const set = require('lodash/set');
const merge = require('lodash/merge');
const reduce = require('lodash/reduce');
const last = require('lodash/last');

// internal deps
const UserMetadata = require('../utils/metadata/user');
const redisKey = require('../utils/key');
const jwt = require('../utils/jwt');
const isDisposable = require('../utils/is-disposable');
const mxExists = require('../utils/mx-exists');
const checkCaptcha = require('../utils/check-captcha');
const { getUserId } = require('../utils/userData');
const aliasExists = require('../utils/alias-exists');
const assignAlias = require('./alias');
const checkLimits = require('../utils/check-ip-limits');
const challenge = require('../utils/challenges/challenge');
const handlePipeline = require('../utils/pipeline-error');
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
  USERS_ACTIVATED_FIELD,
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
const ErrorMalformedAudience = new HttpStatusError(400, 'non-default audience must be accompanied by non-empty metadata or inviteToken');
const ErrorMalformedInvite = new HttpStatusError(400, 'Account must be activated when using invite token');
const ErrorInvitationExpiredOrUsed = new HttpStatusError(400, 'Invitation has expired or already been used');
const ErrorRaceCondition = new HttpStatusError(429, 'multiple concurrent requests');
const ErrorMissing = { statusCode: 404 };

// metadata merger
// comes in the format of audience.data
const mergeMetadata = (accumulator, value, prop) => {
  accumulator[prop] = merge(accumulator[prop] || {}, value);
  return accumulator;
};

/**
 * Token verification function, on top of it returns extra metadata
 * @return {Promise}
 */
async function verifyToken(tokenManager, params) {
  // we must ensure that token matches supplied ID
  // it can be overwritten by sending `anyUsername: true`
  const control = params.anyUsername
    ? { action: USERS_ACTION_INVITE }
    : { action: USERS_ACTION_INVITE, id: params.username };

  const token = await tokenManager
    .verify(params.inviteToken, { erase: false, control });

  if (!token.isFirstVerification) {
    throw ErrorInvitationExpiredOrUsed;
  }

  return reduce(
    token.metadata[TOKEN_METADATA_FIELD_METADATA],
    mergeMetadata,
    params.metadata
  );
}

/**
 * Verifies if there is a referal stored for this user
 * @return {Promise}
 */
async function verifyReferral(redis, params) {
  const key = redisKey(USERS_REF, params.referral);
  const reference = await redis.get(key);

  if (!reference) {
    return null;
  }

  const [creatorAudience] = params.audience;
  params.metadata[creatorAudience][USERS_REFERRAL_FIELD] = reference;
  return null;
}

/**
 * Verifies if SSO token provided, injects decoded SSO profile to metadata
 * @return {Promise}
 */
async function verifySSO(service, params) {
  const { sso, metadata, audience } = params;
  const { uid, provider, profile } = sso;

  const userId = await Promise
    .bind(service, uid)
    .then(getUserId)
    .throw(ErrorConflictUserExists)
    .catchReturn(ErrorMissing, true);

  // always last
  const defaultAudience = last(audience);
  // deep set
  set(metadata, [defaultAudience, provider], profile);

  return userId;
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
 * Performs user registration
 */
async function performRegistration({ service, params }) {
  const {
    username,
    alias,
    sso,
    activate,
    audience,
    metadata,
    challengeType,
  } = params;

  const {
    config,
    redis,
  } = service;

  // do verifications of DB state
  await Promise.bind(service, username)
    .tap(getUserId)
    .throw(ErrorConflictUserExists)
    .catchReturn(ErrorMissing, username);

  if (alias) {
    await aliasExists.call(service, alias);
  }

  if (params.inviteToken) {
    await verifyToken(service.tokenManager, params);
  }

  if (params.referral) {
    await verifyReferral(redis, params);
  }

  if (sso) {
    await verifySSO(service, params);
  }

  const [creatorAudience] = audience;
  const defaultAudience = last(audience);
  const userId = service.flake.next();
  const created = Date.now();
  const pipeline = redis.pipeline();
  const basicInfo = {
    [USERS_CREATED_FIELD]: created,
    [USERS_USERNAME_FIELD]: username,
    [USERS_ACTIVE_FLAG]: activate,
  };

  if (params.skipPassword === false) {
    // this will be passed as context if we need to send an email
    // effectively allowing us to get some meta like firstName and lastName
    // for personalized emails
    const originalMeta = metadata[creatorAudience];
    const { password } = params;

    basicInfo[USERS_PASSWORD_FIELD] = await hashPassword.call(service, password, challengeType, username, originalMeta);
  }

  if (sso) {
    const { provider, uid, credentials } = sso;

    // inject sensitive provider info to internal data
    basicInfo[provider] = JSON.stringify(credentials.internals);

    // link uid to username
    pipeline.hset(USERS_SSO_TO_ID, uid, userId);
  }

  const userDataKey = redisKey(userId, USERS_DATA);
  pipeline.hmset(userDataKey, basicInfo);
  pipeline.hset(USERS_USERNAME_TO_ID, username, userId);

  if (activate === false && config.deleteInactiveAccounts >= 0) {
    pipeline.expire(userDataKey, config.deleteInactiveAccounts);
  }

  handlePipeline(await pipeline.exec());

  const commonMeta = {
    [USERS_ID_FIELD]: userId,
    [USERS_USERNAME_FIELD]: username,
    [USERS_CREATED_FIELD]: created,
  };

  if (activate === true) {
    commonMeta[USERS_ACTIVATED_FIELD] = Date.now();
  }

  await UserMetadata
    .using(userId, audience, service.redis)
    .batchUpdate({
      metadata: audience.map((metaAudience) => ({
        $set: Object.assign(metadata[metaAudience] || {}, metaAudience === defaultAudience && commonMeta),
      })),
    });

  // assign alias
  if (alias) {
    await assignAlias.call(service, {
      params: {
        username,
        alias,
        internal: true,
      },
    });
  }

  if (activate === true) {
    // perform instant activation
    // internal username index
    const regPipeline = redis.pipeline().sadd(USERS_INDEX, userId);
    const ref = metadata[creatorAudience][USERS_REFERRAL_FIELD];

    // add to referral index during registration
    // on instant activation
    if (ref) {
      regPipeline.sadd(`${USERS_REFERRAL_INDEX}:${ref}`, userId);
    }

    return regPipeline
      .exec()
      .then(handlePipeline)
      // custom actions
      .bind(service)
      .return(['users:activate', userId, params, metadata])
      .spread(service.hook)
      // login & return JWT
      .return([userId, creatorAudience])
      .spread(jwt.login);
  }

  const challengeOpts = {
    id: username,
    action: USERS_ACTION_ACTIVATE,
    ...config.token[challengeType],
  };

  const metaCopy = {
    ...metadata[creatorAudience],
  };

  const challengeResponse = params.skipChallenge
    ? null
    : await challenge.call(service, challengeType, challengeOpts, metaCopy);

  return challengeResponse
    ? {
      id: userId,
      requiresActivation: true,
      uid: challengeResponse.context.token.uid,
    }
    : {
      id: userId,
      requiresActivation: true,
    };
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
module.exports = async function registerUser({ params }) {
  const service = this;
  const { redis, config } = service;
  const { username } = params;

  // 1. perform logic checks
  // 2. acquire registration lock
  // 3. create pipeline that adds all the user data into the system atomically to avoid failures

  // optional captcha verification
  if ('captcha' in params) {
    await checkCaptcha(redis, username, params.captcha, config.captcha);
  }

  const limits = config.registrationLimits;
  if (limits) {
    if (limits.noDisposable) {
      // sync function, throws
      isDisposable(username);
    }

    if (params.challengeType === CHALLENGE_TYPE_EMAIL && limits.checkMX) {
      await mxExists(username);
    }

    if (limits.ip && params.ipaddress) {
      await checkLimits(redis, limits, params.ipaddress);
    }
  }

  // lock acquisition
  const acquireLock = this.dlock
    .multi(lockRegister(username), params.alias && lockAlias(params.alias))
    .disposer(lockDisposer);

  return Promise
    .using({ service, params }, acquireLock, performRegistration)
    .catchThrow(LockAcquisitionError, ErrorRaceCondition);
};

// transform `sso` token if it's present
module.exports.allowed = async function transformSSO({ params }) {
  const {
    sso,
    activate,
    inviteToken,
    alias,
    audience,
    metadata,
  } = params;

  const { defaultAudience } = this.config.jwt;

  // inject default audience if it's not present
  params.audience = audience === defaultAudience
    ? [audience]
    : [audience, defaultAudience];

  // in case we have 2 audiences, no invite token & no extra metadata
  // -> throw malformed error
  if (audience.length === 2 && metadata == null && inviteToken == null) {
    throw ErrorMalformedAudience;
  }

  // ensure it's formatted and set to lowercase
  if (alias) {
    params.alias = alias.toLowerCase();
  }

  // normalize metadata
  params.metadata = {
    [audience]: params.metadata || {},
  };

  // if there is no sso - don't do anything
  if (sso === undefined) {
    // set defaults for required activation when SSO is undefined
    // NOTE: this is to preserve back-compatibility before sso was introduced
    // if sso is undefined abd activate is undefined, then it defaults to true,
    // otherwise it's true/false/undefined based on what's passed
    if (activate === undefined) {
      params.activate = true;
    } else if (inviteToken && activate === false) {
      throw ErrorMalformedInvite;
    }

    return null;
  }

  if (inviteToken && activate !== true) {
    throw ErrorMalformedInvite;
  }

  // retrieve configuration options
  const ssoTokenOptions = this.config.oauth.token;

  // verify SSO token & rewrite params.sso
  const credentials = await jwt.verifyData(sso, ssoTokenOptions);

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

  // skip activation if email is given by sso provider and equals to registered email
  if (params.activate === undefined) {
    params.activate = email ? params.username === email : false;
  }

  return null;
};

// init transport
module.exports.transports = [ActionTransport.amqp, ActionTransport.internal];
