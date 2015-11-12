const Promise = require('bluebird');
const Errors = require('common-errors');
const scrypt = require('../utils/scrypt.js');
const redisKey = require('../utils/key.js');
const jwt = require('../utils/jwt.js');

module.exports = function login(opts) {
  const config = this._config.jwt;
  const { _redis: redis } = this;
  const { username, password } = opts;
  const { lockAfterAttempts, defaultAudience } = config;
  const audience = opts.audience || defaultAudience;
  const remoteip = opts.remoteip || false;
  const usernameKey = redisKey(username, 'data');

  let promise = Promise.bind(this);
  let loginAttempts;
  if (remoteip && lockAfterAttempts > 0) {
    const remoteipKey = redisKey(usernameKey, remoteip);
    promise = promise.then(function checkLoginAttempts() {
      // construct pipeline
      const pipeline = redis.pipeline();
      pipeline.incrby(remoteipKey, 1);
      if (config.keepLoginAttempts > 0) {
        pipeline.expire(remoteipKey, config.keepLoginAttempts);
      }

      return pipeline
        .exec()
        .spread()
          .then(function incremented(incrementValue) {
            const err = incrementValue[0];
            if (err) {
              this.log.error('Redis error:', err);
              return;
            }

            loginAttempts = incrementValue[1];
            if (loginAttempts > lockAfterAttempts) {
              throw new Errors.HttpStatusError(429, 'You are locked from making login attempts for the next 24 hours');
            }
          });
    });
  } else {
    promise = Promise.resolve();
  }

  return promise.then(function getHashedPasswordAndUserState() {
    return redis.hmgetBuffer(usernameKey, 'password', 'active');
  })
  .then(function hashedPasswordAndUserState([ passwordHashBuffer, activeBuffer ]) {
    if (!passwordHashBuffer) {
      throw new Errors.HttpStatusError(403, 'username does not exist');
    }

    return scrypt
      .verify(passwordHashBuffer, password)
      .then(function verificationResult(matches) {
        if (matches !== true) {
          throw new Errors.HttpStatusError(403, 'incorrect password');
        }

        if (remoteip) {
          loginAttempts = 0;
          return redis.del(remoteip);
        }
      })
      .then(function checkAccountActivation() {
        if (!activeBuffer || activeBuffer.toString() !== 'true') {
          throw new Errors.HttpStatusError(412, 'Account hasn\'t been activated');
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
