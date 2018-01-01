const Promise = require('bluebird');
const Errors = require('common-errors');
const redisKey = require('../utils/key');
const jwt = require('../utils/jwt');
const getInternalData = require('../utils/getInternalData');
const getMetadata = require('../utils/getMetadata');
const userExists = require('../utils/userExists');
const handlePipeline = require('../utils/pipelineError');
const {
  USERS_INDEX,
  USERS_DATA,
  USERS_REFERRAL_INDEX,
  USERS_PUBLIC_INDEX,
  USERS_ACTIVE_FLAG,
  USERS_ALIAS_FIELD,
  USERS_REFERRAL_FIELD,
  USERS_USERNAME_FIELD,
  USERS_ACTION_ACTIVATE,
} = require('../constants.js');

// cache error
const Forbidden = new Errors.HttpStatusError(403, 'invalid token');
const Inactive = new Errors.HttpStatusError(412, 'expired token, please request a new email');
const Active = new Errors.HttpStatusError(409, 'account is already active, please use sign in form');

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
function isAccountActive(data) {
  const username = data[USERS_USERNAME_FIELD];
  const userKey = redisKey(username, USERS_DATA);
  return this.redis
    .hget(userKey, USERS_ACTIVE_FLAG)
    .then(throwBasedOnStatus);
}

/**
 * Modifies error from the token
 */
function RethrowForbidden(e) {
  this.log.warn({ token: this.token, username: this.username, args: e.args }, 'failed to activate', e.message);

  // remap error message
  // and possibly status code
  if (!e.args) {
    throw Forbidden;
  }

  return Promise
    .bind(this, e.args.id)
    // if it can't get internal data - will throw 404
    .then(getInternalData)
    // if it's active will throw 409, otherwise 412
    .then(isAccountActive);
}

/**
 * Simple invocation for userExists
 */
function doesUserExist() {
  return userExists.call(this.service, this.username);
}

/**
 * Verifies validity of token
 */
function verifyToken() {
  let args;
  const { token, username, service } = this;
  const action = USERS_ACTION_ACTIVATE;
  const opts = { erase: this.erase };

  if (username) {
    args = {
      action,
      token,
      id: username,
    };
  } else {
    args = token;
    opts.control = { action };
  }

  return this.service
    .tokenManager
    .verify(args, opts)
    .bind({
      log: service.log, redis: service.redis, token, username,
    })
    .catch(RethrowForbidden)
    .get('id');
}

/**
 * Activates account after it was verified
 * @param  {Object} data internal user data
 * @return {Promise}
 */
function activateAccount(data, metadata) {
  const user = data[USERS_USERNAME_FIELD];
  const alias = data[USERS_ALIAS_FIELD];
  const referral = metadata[USERS_REFERRAL_FIELD];
  const userKey = redisKey(user, USERS_DATA);

  // WARNING: `persist` is very important, otherwise we will lose user's information in 30 days
  // set to active & persist
  const pipeline = this.redis
    .pipeline()
    .hget(userKey, USERS_ACTIVE_FLAG)
    .hset(userKey, USERS_ACTIVE_FLAG, 'true')
    .persist(userKey)
    .sadd(USERS_INDEX, user);

  if (alias) {
    pipeline.sadd(USERS_PUBLIC_INDEX, user);
  }

  if (referral) {
    pipeline.sadd(`${USERS_REFERRAL_INDEX}:${referral}`, user);
  }

  return pipeline
    .exec()
    .then(handlePipeline)
    .spread(function pipeResponse(isActive) {
      const status = isActive;
      if (status === 'true') {
        throw new Errors.HttpStatusError(417, `Account ${user} was already activated`);
      }
    })
    .return(user);
}

/**
 * Invokes available hooks
 */
function hook(user) {
  return this.service.hook('users:activate', user, { audience: this.audience });
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
module.exports = function verifyChallenge({ params }) {
  // TODO: add security logs
  // var remoteip = request.params.remoteip;
  const { token, username } = params;
  const { log, config } = this;
  const audience = params.audience || config.defaultAudience;

  log.debug('incoming request params %j', params);

  // basic context
  const ctx = {
    username,
    token,
    audience,
    service: this,
    erase: config.token.erase,
  };

  return Promise
    .bind(ctx)
    .then(token ? verifyToken : doesUserExist)
    .bind(this)
    .then(resolvedUsername => Promise.join(
      getInternalData.call(this, resolvedUsername),
      getMetadata.call(this, resolvedUsername, audience).get(audience)
    ))
    .spread(activateAccount)
    .bind(ctx)
    .tap(hook)
    .bind(this)
    .then(user => [user, audience])
    .spread(jwt.login);
};

module.exports.transports = [require('@microfleet/core').ActionTransport.amqp];
