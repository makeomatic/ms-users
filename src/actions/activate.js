const Promise = require('bluebird');
const Errors = require('common-errors');
const redisKey = require('../utils/key.js');
const jwt = require('../utils/jwt.js');
const getInternalData = require('../utils/getInternalData.js');
const userExists = require('../utils/userExists.js');
const handlePipeline = require('../utils/pipelineError.js');
const {
  USERS_INDEX,
  USERS_DATA,
  USERS_PUBLIC_INDEX,
  USERS_ACTIVE_FLAG,
  USERS_ALIAS_FIELD,
  USERS_USERNAME_FIELD,
  USERS_ACTION_ACTIVATE,
} = require('../constants.js');

// cache error
const Forbidden = new Errors.HttpStatusError(403, 'invalid token');

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
function verifyChallenge(request) {
  // TODO: add security logs
  // var remoteip = request.params.remoteip;
  const { token, username } = request.params;
  const { redis, config, log } = this;
  const audience = request.params.audience || config.defaultAudience;

  log.debug('incoming request params %j', request.params);

  function verifyToken() {
    let args;
    const action = USERS_ACTION_ACTIVATE;
    const opts = { erase: config.token.erase };

    if (username) {
      args = {
        action,
        id: username,
        token,
      };
    } else {
      args = token;
      opts.control = { action };
    }

    return this.tokenManager.verify(args, opts)
      .catchThrow(Forbidden)
      .get('id');
  }

  function activateAccount(data) {
    const user = data[USERS_USERNAME_FIELD];
    const alias = data[USERS_ALIAS_FIELD];
    const userKey = redisKey(user, USERS_DATA);

    // WARNING: `persist` is very important, otherwise we will lose user's information in 30 days
    // set to active & persist
    const pipeline = redis
      .pipeline()
      .hget(userKey, USERS_ACTIVE_FLAG)
      .hset(userKey, USERS_ACTIVE_FLAG, 'true')
      .persist(userKey)
      .sadd(USERS_INDEX, user);

    if (alias) {
      pipeline.sadd(USERS_PUBLIC_INDEX, user);
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

  function hook(user) {
    return this.hook.call(this, 'users:activate', user, audience);
  }

  return Promise
    .bind(this, username)
    .then(token ? verifyToken : userExists)
    .then(getInternalData)
    .then(activateAccount)
    .tap(hook)
    .then(user => [user, audience])
    .spread(jwt.login);
}

module.exports = verifyChallenge;
