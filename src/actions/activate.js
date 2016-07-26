const Promise = require('bluebird');
const Errors = require('common-errors');
const redisKey = require('../utils/key.js');
const emailVerification = require('../utils/send-email.js');
const jwt = require('../utils/jwt.js');
const userExists = require('../utils/userExists.js');
const { USERS_INDEX, USERS_DATA, USERS_ACTIVE_FLAG } = require('../constants.js');

/**
 * @api {amqp} <prefix>.activate Activate User
 * @apiVersion 1.0.0
 * @apiName ActivateUser
 * @apiGroup Users
 *
 * @apiDescription This method allows one to activate user by 2 means: providing a username or encoded verification token.
 * When only username is provided, no verifications will be performed and user will be set to active. In contrary, `token`
 * would be verified. This allows for 2 scenarios: admin activating a user, or user completing verification challenge. In
 * case of success output would contain user object
 *
 * @apiParam (Payload) {String} username - currently email of the user
 * @apiParam (Payload) {String} token - if present, would be used against test challenge
 * @apiParam (Payload) {String} [remoteip] - not used, but is reserved for security log in the future
 * @apiParam (Payload) {String} [audience] - additional metadata will be pushed there from custom hooks
 *
 */
function verifyChallenge(request) {
  // TODO: add security logs
  // var remoteip = request.params.remoteip;
  const { token, username } = request.params;
  const { redis, config } = this;
  const audience = request.params.audience || config.defaultAudience;

  function verifyToken() {
    return emailVerification.verify.call(this, token, 'activate', config.validation.ttl > 0);
  }

  function activateAccount(user) {
    const userKey = redisKey(user, USERS_DATA);

    // WARNING: `persist` is very important, otherwise we will lose user's information in 30 days
    // set to active & persist
    return redis
      .pipeline()
      .hget(userKey, USERS_ACTIVE_FLAG)
      .hset(userKey, USERS_ACTIVE_FLAG, 'true')
      .persist(userKey)
      .sadd(USERS_INDEX, user)
      .exec()
      .spread(function pipeResponse(isActive) {
        const status = isActive[1];
        if (status === 'true') {
          throw new Errors.HttpStatusError(417, `Account ${user} was already activated`);
        }
      });
  }

  function hook(user) {
    return this.hook.call(this, 'users:activate', user, audience);
  }

  return Promise
    .bind(this, username)
    .then(username ? userExists : verifyToken)
    .tap(activateAccount)
    .tap(hook)
    .then(user => [user, audience])
    .spread(jwt.login);
}

module.exports = verifyChallenge;
