const { ActionTransport } = require('@microfleet/core');
const { HttpStatusError } = require('common-errors');
const Promise = require('bluebird');
const redisKey = require('../utils/key');
const jwt = require('../utils/jwt');
const { getInternalData } = require('../utils/userData');
const getMetadata = require('../utils/get-metadata');
const handlePipeline = require('../utils/pipeline-error');
const setMetadata = require('../utils/update-metadata');
const {
  USERS_INDEX,
  USERS_DATA,
  USERS_REFERRAL_INDEX,
  USERS_PUBLIC_INDEX,
  USERS_ACTIVE_FLAG,
  USERS_ID_FIELD,
  USERS_ALIAS_FIELD,
  USERS_REFERRAL_FIELD,
  USERS_USERNAME_FIELD,
  USERS_ACTION_ACTIVATE,
  USERS_ACTIVATED_FIELD,
} = require('../constants');

// cache error
const Forbidden = new HttpStatusError(403, 'invalid token');
const Inactive = new HttpStatusError(412, 'expired token, please request a new email');
const Active = new HttpStatusError(409, 'account is already active, please use sign in form');

/**
 * Helper to determine if something is true
 */
function throwBasedOnStatus(status) {
  if (status === 'true') {
    throw Active;
  }

  throw Inactive;
}

/**
 * Verifies that account is active
 */
function isAccountActive(username) {
  return getInternalData
    .call(this, username)
    .then((userData) => userData[USERS_ACTIVE_FLAG])
    .then(throwBasedOnStatus);
}

/**
 * Modifies error from the token
 */
function RethrowForbidden(error) {
  const { log, token, username } = this;
  const { args, message } = error;

  log.warn({ token, username, args }, 'failed to activate', message);

  // remap error message
  // and possibly status code
  if (!args) {
    throw Forbidden;
  }

  return Promise
    .bind(this, args.id)
    // if it's active will throw 409, otherwise 412
    .then(isAccountActive);
}

function verifyToken(args, opts) {
  const { tokenManager } = this;

  return Promise
    .resolve(tokenManager.verify(args, opts))
    .bind(this)
    .catch(RethrowForbidden)
    .get('id');
}

function verifyRequest() {
  const {
    username, token, service: { tokenManager, redis, log }, erase,
  } = this;
  const action = USERS_ACTION_ACTIVATE;
  const context = {
    log, redis, token, username, tokenManager,
  };

  if (username && token) {
    return getInternalData
      .call(this.service, username)
      .then((userData) => [
        { action, token, id: userData[USERS_USERNAME_FIELD] },
        { erase },
      ])
      .bind(context)
      .spread(verifyToken);
  }

  if (token) {
    return verifyToken.call(context, token, { erase, control: { action } });
  }

  if (username) {
    return Promise.resolve(username);
  }

  throw new HttpStatusError(400, 'invalid params');
}

/**
 * Activates account after it was verified
 * @param  {Object} data internal user data
 * @return {Promise}
 */
async function activateAccount(data, metadata) {
  const userId = data[USERS_ID_FIELD];
  const alias = data[USERS_ALIAS_FIELD];
  const referral = metadata[USERS_REFERRAL_FIELD];
  const userKey = redisKey(userId, USERS_DATA);
  const { defaultAudience, service } = this;
  const { redis } = service;

  // if this goes through, but other async calls fail its ok to repeat that
  // adds activation field
  await setMetadata.call(service, {
    userId,
    audience: defaultAudience,
    metadata: {
      $set: {
        [USERS_ACTIVATED_FIELD]: Date.now(),
      },
    },
  });

  // WARNING: `persist` is very important, otherwise we will lose user's information in 30 days
  // set to active & persist
  const pipeline = redis
    .pipeline()
    .hget(userKey, USERS_ACTIVE_FLAG)
    .hset(userKey, USERS_ACTIVE_FLAG, 'true')
    .persist(userKey)
    .sadd(USERS_INDEX, userId);

  if (alias) {
    pipeline.sadd(USERS_PUBLIC_INDEX, userId);
  }

  if (referral) {
    pipeline.sadd(`${USERS_REFERRAL_INDEX}:${referral}`, userId);
  }

  const [isActive] = handlePipeline(await pipeline.exec());

  if (isActive === 'true') {
    throw new HttpStatusError(417, `Account ${userId} was already activated`);
  }

  return userId;
}

/**
 * Invokes available hooks
 */
function hook(userId) {
  return this.service.hook('users:activate', userId, { audience: this.audience });
}

/**
 * @api {amqp} <prefix>.activate Activate User
 * @apiVersion 1.0.0
 * @apiName ActivateUser
 * @apiGroup Users
 *
 * @apiDescription This method allows one to activate user by 3 means:
 * 1) When only `username` is provided, no verifications will be performed and user will be set
 *    to active. This case is used when admin activates a user.
 * 2) When only `token` is provided that means that token is encrypted and would be verified.
 *    This case is used when user completes verification challenge.
 * 3) This case is similar to the previous, but used both `username` and `token` for
 *    verification. Use this when the token isn't decrypted.
 * Success response contains user object.
 *
 * @apiParam (Payload) {String} username - id of the user
 * @apiParam (Payload) {String} token - verification token
 * @apiParam (Payload) {String} [remoteip] - not used, but is reserved for security log in the future
 * @apiParam (Payload) {String} [audience] - additional metadata will be pushed there from custom hooks
 *
 */
async function activateAction({ log, params }) {
  // TODO: add security logs
  // var remoteip = request.params.remoteip;
  const { token, username } = params;
  const { config } = this;
  const { jwt: { defaultAudience } } = config;
  const audience = params.audience || defaultAudience;

  log.debug({ params }, 'incoming request params');

  // basic context
  const context = {
    audience,
    defaultAudience,
    token,
    username,
    service: this,
    erase: config.token.erase,
  };

  const userId = await Promise
    .bind(context)
    .then(verifyRequest)
    .then((resolvedUsername) => getInternalData.call(this, resolvedUsername))
    .then((internalData) => Promise.join(
      internalData,
      getMetadata.call(this, internalData[USERS_ID_FIELD], audience).get(audience)
    ))
    .spread(activateAccount)
    .tap(hook);

  return jwt.login.call(this, userId, audience);
}

activateAction.transports = [ActionTransport.amqp];

module.exports = activateAction;
