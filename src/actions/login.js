const Promise = require('bluebird');
const Errors = require('common-errors');
const scrypt = require('../utils/scrypt.js');
const redisKey = require('../utils/key.js');
const jwt = require('../utils/jwt.js');
const moment = require('moment');
const isActive = require('../utils/isActive.js');
const isBanned = require('../utils/isBanned.js');
const getInternalData = require('../utils/getInternalData.js');
const noop = require('lodash/noop');
const { USERS_DATA } = require('../constants.js');

module.exports = function login(opts) {
  const config = this.config.jwt;
  const { redis } = this;
  const { username, password } = opts;
  const { lockAfterAttempts, defaultAudience } = config;
  const audience = opts.audience || defaultAudience;
  const remoteip = opts.remoteip || false;
  const usernameKey = redisKey(username, USERS_DATA);

  let promise = Promise.bind(this, username);
  let loginAttempts;
  let remoteipKey;
  if (remoteip && lockAfterAttempts > 0) {
    remoteipKey = redisKey(usernameKey, remoteip);
    promise = promise.tap(function checkLoginAttempts() {
      // construct pipeline
      const pipeline = redis.pipeline();

      pipeline.incrby(remoteipKey, 1);
      if (config.keepLoginAttempts > 0) {
        pipeline.expire(remoteipKey, config.keepLoginAttempts);
      }

      return pipeline
        .exec()
        .spread(function incremented(incrementValue) {
          const err = incrementValue[0];
          if (err) {
            this.log.error('Redis error:', err);
            return;
          }

          loginAttempts = incrementValue[1];
          if (loginAttempts > lockAfterAttempts) {
            const duration = moment().add(config.keepLoginAttempts, 'seconds').toNow(true);
            const msg = `You are locked from making login attempts for the next ${duration}`;
            throw new Errors.HttpStatusError(429, msg);
          }
        });
    });
  }

  function verifyHash(data) {
    const { password: hash } = data;
    return scrypt.verify(hash, password);
  }

  function dropLoginCounter() {
    loginAttempts = 0;
    return redis.del(remoteipKey);
  }

  function getUserInfo() {
    return jwt.login.call(this, username, audience);
  }

  return promise
    .then(getInternalData)
    .tap(verifyHash)
    .tap(remoteip ? dropLoginCounter : noop)
    .tap(isActive)
    .tap(isBanned)
    .then(getUserInfo)
    .catch(function enrichError(err) {
      if (remoteip) {
        err.loginAttempts = loginAttempts; // eslint-disable-line
      }

      throw err;
    });
};
