const Promise = require('bluebird');
const Errors = require('common-errors');
const scrypt = require('../utils/scrypt.js');
const redisKey = require('../utils/key.js');
const jwt = require('../utils/jwt.js');
const moment = require('moment');

module.exports = function login(opts) {
  const config = this.config.jwt;
  const { redis } = this;
  const { username, password } = opts;
  const { lockAfterAttempts, defaultAudience } = config;
  const audience = opts.audience || defaultAudience;
  const remoteip = opts.remoteip || false;
  const usernameKey = redisKey(username, 'data');

  let promise = Promise.bind(this);
  let loginAttempts;
  let remoteipKey;
  if (remoteip && lockAfterAttempts > 0) {
    remoteipKey = redisKey(usernameKey, remoteip);
    promise = promise.then(function checkLoginAttempts() {
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
            throw new Errors.HttpStatusError(429, 'You are locked from making login attempts for the next ' + moment().add(config.keepLoginAttempts, 'seconds').toNow(true));
          }
        });
    });
  }

  return promise.then(function getHashedPasswordAndUserState() {
    return redis.hmgetBuffer(usernameKey, 'password', 'active', 'banned');
  })
  .spread(function hashedPasswordAndUserState(passwordHashBuffer, activeBuffer, isBanned) {
    if (!passwordHashBuffer) {
      throw new Errors.HttpStatusError(404, 'username does not exist');
    }

    return scrypt
      .verify(passwordHashBuffer, password)
      .then(function verificationResult() {
        if (remoteip) {
          loginAttempts = 0;
          return redis.del(remoteipKey);
        }
      })
      .then(function checkAccountActivation() {
        if (!activeBuffer || activeBuffer.toString() !== 'true') {
          throw new Errors.HttpStatusError(412, 'Account hasn\'t been activated');
        }

        if (isBanned && isBanned.toString() === 'true') {
          throw new Errors.HttpStatusError(423, 'Account has been locked');
        }
      });
  })
  .then(function getUserInfo() {
    return jwt.login.call(this, username, audience);
  })
  .catch(function enrichError(err) {
    if (remoteip) {
      err.loginAttempts = loginAttempts;
    }

    throw err;
  });
};
