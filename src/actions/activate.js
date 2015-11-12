const Promise = require('bluebird');
const Errors = require('common-errors');
const redisKey = require('../utils/key.js');
const emailVerification = require('../utils/send-email.js');
const jwt = require('../utils/jwt.js');

module.exports = function verifyChallenge(opts) {
  // TODO: add security logs
  // var remoteip = opts.remoteip;
  const { token, audience, namespace, username } = opts;
  const { _redis: redis, _config: config } = this;

  let promise = Promise.bind(this);

  if (!username) {
    promise = promise.then(function verifyToken() {
      return emailVerification.verify.call(this, token, namespace, config.validation.ttl > 0);
    });
  } else {
    promise = promise.then(function verifyUserExists() {
      const userKey = redisKey(username, 'data');
      return redis
        .hexists(userKey, 'active')
        .then(function fieldExists(exists) {
          if (!exists) {
            throw new Errors.HttpStatusError(404, 'user does not exist');
          }
        })
        .return(username);
    });
  }

  return promise
    .then(function activateAccount(user) {
      const userKey = redisKey(user, 'data');

      // set to active
      return redis
        .pipeline()
        .hget(userKey, 'active')
        .hset(userKey, 'active', 'true')
        .persist(userKey) // WARNING: this is very important, otherwise we will lose user's information in 30 days
        .exec()
        .spread(function pipeResponse(isActive) {
          const status = isActive[1];
          if (status === 'true') {
            throw new Errors.HttpStatusError(413, `Account ${user} was already activated`);
          }
        })
        .return(user);
    })
    .then(function returnUserInfo(user) {
      return jwt.login.call(this, user, audience || config.defaultAudience);
    });
};
