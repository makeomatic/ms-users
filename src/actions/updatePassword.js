const Errors = require('common-errors');
const scrypt = require('../utils/scrypt.js');
const redisKey = require('../utils/key.js');
const jwt = require('../utils/jwt.js');
const emailChallenge = require('../utils/send-email.js');

/**
 * Verifies token and deletes it if it matches
 * @param {Strong} token
 */
function tokenReset(token) {
  return emailChallenge.verify.call(this, token, 'reset', true);
}

/**
 * Verify that username and password match
 * @param {String} username
 * @param {String} password
 */
function usernamePasswordReset(username, password) {
  const { redis } = this;
  const userKey = redisKey(username, 'data');
  return redis
    .hmgetBuffer(userKey, 'password', 'active')
    .spread(function responses(hash, active) {
      if (!hash) {
        throw new Errors.HttpStatusError(404, 'user does not exist');
      }

      if (String(active) !== 'true') {
        throw new Errors.HttpStatusError(412, 'account is not active or does not exist');
      }

      if (!Buffer.isBuffer(hash) || hash.length < 1) {
        throw new Errors.HttpStatusError(500, 'invalid password hash');
      }

      return scrypt.verify(hash, password);
    })
    .return(username);
}

/**
 * Sets new password for a given username
 * @param {String} username
 * @param {String} password
 */
function setPassword(username, password) {
  const { redis } = this;

  return scrypt
    .hash(password)
    .then(function calculatedHash(hash) {
      const userKey = redisKey(username, 'data');
      return redis
        .hset(userKey, 'password', hash)
        .then(function updatedPassword(result) {
          if (result !== 1) {
            return null;
          }

          return redis.hdel(userKey, 'password').done(function reportError() {
            throw new Errors.HttpStatusError(404, 'username does not exist');
          });
        });
    })
    .return(username);
}

module.exports = exports = function updatePassword(opts) {
  const { redis } = this;
  const { newPassword: password, remoteip } = opts;
  const invalidateTokens = !!opts.invalidateTokens;

  // 2 cases - token reset and current password reset
  let promise;
  if (opts.resetToken) {
    promise = tokenReset.call(this, opts.resetToken);
  } else {
    promise = usernamePasswordReset.call(this, opts.username, opts.currentPassword);
  }

  // update password
  promise = promise
    .then(username => {
      return setPassword.call(this, username, password);
    });

  if (invalidateTokens) {
    promise = promise.tap(username => {
      return jwt.reset.call(this, username);
    });
  }

  if (remoteip) {
    promise = promise.tap(function resetLock(username) {
      return redis.del(redisKey(username, 'data', remoteip));
    });
  }

  return promise.return({ success: true });
};

/**
 * Update password handler
 */
exports.updatePassword = setPassword;
