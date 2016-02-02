const Promise = require('bluebird');
const Errors = require('common-errors');
const redisKey = require('../utils/key.js');
const emailVerification = require('../utils/send-email.js');
const jwt = require('../utils/jwt.js');
const userExists = require('../utils/userExists.js');
const { USERS_INDEX, USERS_DATA, USERS_ACTIVE_FLAG } = require('../constants.js');

module.exports = function verifyChallenge(opts) {
  // TODO: add security logs
  // var remoteip = opts.remoteip;
  const { token, namespace, username } = opts;
  const { redis, config } = this;
  const audience = opts.audience || config.defaultAudience;

  function verifyToken() {
    return emailVerification.verify.call(this, token, namespace, config.validation.ttl > 0);
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

  function postHook(user) {
    return this.postHook('users:activate', user, audience);
  }

  return Promise
    .bind(this, username)
    .then(username ? userExists : verifyToken)
    .tap(activateAccount)
    .tap(postHook)
    .then(user => jwt.login.call(this, user, audience));
};
