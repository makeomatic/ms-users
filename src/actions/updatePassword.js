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

/**
 * @api {amqp} <prefix>.updatePassword Update Password
 * @apiVersion 1.0.0
 * @apiName UpdatePassword
 * @apiGroup Users
 *
 * @apiDescription Allows one to update password via current password + username combo or via verification token. Optionally allows to invalidate
 * all issued JWT token for a given user. Valid input includes combos of `username`, `currentPassword` OR `resetToken`.
 *
 * @apiParam (Payload) {String} [username] - currently only email is supported
 * @apiParam (Payload) {String} [currentPassword] - current password
 * @apiParam (Payload) {String} [resetToken] - must be present if `username` or `currentPassword` is not
 * @apiParam (Payload) {String} newPassword - password will be changed to this
 * @apiParam (Payload) {Boolean} [invalidateTokens=false] - if set to `true` will invalidate issued tokens
 * @apiParam (Payload) {String} [remoteip] - will be used for rate limiting if supplied
 */
function updatePassword(request) {
  const { redis } = this;
  const { newPassword: password, remoteip } = request.params;
  const invalidateTokens = !!request.params.invalidateTokens;

  // 2 cases - token reset and current password reset
  let promise;
  if (request.params.resetToken) {
    promise = tokenReset.call(this, request.params.resetToken);
  } else {
    promise = usernamePasswordReset.call(
      this, request.params.username, request.params.currentPassword
    );
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
}

/**
 * Update password handler
 */
updatePassword.updatePassword = setPassword;

module.exports = updatePassword;
