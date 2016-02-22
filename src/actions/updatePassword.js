const Promise = require('bluebird');
const scrypt = require('../utils/scrypt.js');
const redisKey = require('../utils/key.js');
const jwt = require('../utils/jwt.js');
const emailChallenge = require('../utils/send-email.js');
const getInternalData = require('../utils/getInternalData.js');
const isActive = require('../utils/isActive.js');
const isBanned = require('../utils/isBanned.js');
const userExists = require('../utils/userExists.js');
const { USERS_DATA } = require('../constants.js');

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
  return Promise
    .bind(this, username)
    .then(getInternalData)
    .tap(isActive)
    .tap(isBanned)
    .tap(data => scrypt.verify(data.password, password))
    .return(username);
}

/**
 * Sets new password for a given username
 * @param {String} username
 * @param {String} password
 */
function setPassword(_username, password) {
  const { redis } = this;

  return Promise
    .bind(this, _username)
    .then(userExists)
    .then(username => Promise.props({
      username,
      hash: scrypt.hash(password),
    }))
    .then(({ username, hash }) =>
      redis
        .hset(redisKey(username, USERS_DATA), 'password', hash)
        .return(username)
    );
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
    .then(username => setPassword.call(this, username, password));

  if (invalidateTokens) {
    promise = promise.tap(username => jwt.reset.call(this, username));
  }

  if (remoteip) {
    promise = promise.tap(function resetLock(username) {
      return redis.del(redisKey(username, 'ip', remoteip));
    });
  }

  return promise.return({ success: true });
};

/**
 * Update password handler
 */
exports.updatePassword = setPassword;
