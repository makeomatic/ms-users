const Promise = require('bluebird');
const scrypt = require('../utils/scrypt.js');
const Errors = require('common-errors');
const redisKey = require('../utils/key.js');
const jwt = require('../utils/jwt.js');
const getInternalData = require('../utils/getInternalData.js');
const isActive = require('../utils/isActive.js');
const isBanned = require('../utils/isBanned.js');
const hasPassword = require('../utils/hasPassword.js');
const userExists = require('../utils/userExists.js');
const partialRight = require('lodash/partialRight');
const { USERS_DATA, USERS_ACTION_RESET, USERS_PASSWORD_FIELD } = require('../constants.js');

// cache error
const Forbidden = new Errors.HttpStatusError(403, 'invalid token');

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
    .tap(hasPassword)
    .tap(data => scrypt.verify(data.password, password))
    .then(data => data.username);
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
        .hset(redisKey(username, USERS_DATA), USERS_PASSWORD_FIELD, hash)
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
    promise = this.tokenManager
      .verify(request.params.resetToken, {
        erase: true,
        control: {
          action: USERS_ACTION_RESET,
        },
      })
      .catchThrow(Forbidden)
      .get('id')
      .bind(this);
  } else {
    promise = Promise
      .bind(this, [request.params.username, request.params.currentPassword])
      .spread(usernamePasswordReset);
  }

  // update password
  promise = promise.then(partialRight(setPassword, password));

  if (invalidateTokens) {
    promise = promise.tap(jwt.reset);
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
