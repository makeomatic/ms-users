const Promise = require('bluebird');
const Errors = require('common-errors');
const partialRight = require('lodash/partialRight');
const scrypt = require('../utils/scrypt');
const redisKey = require('../utils/key');
const jwt = require('../utils/jwt');
const { getInternalData } = require('../utils/userData');
const isActive = require('../utils/isActive');
const isBanned = require('../utils/isBanned');
const hasPassword = require('../utils/hasPassword');
const { getUserId } = require('../utils/userData');
const {
  USERS_DATA,
  USERS_ACTION_RESET,
  USERS_PASSWORD_FIELD,
  USERS_ID_FIELD,
} = require('../constants');

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
    .then(data => data[USERS_ID_FIELD]);
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
    .then(getUserId)
    .then(userId => Promise.props({
      userId,
      hash: scrypt.hash(password),
    }))
    .then(({ userId, hash }) => redis
      .hset(redisKey(userId, USERS_DATA), USERS_PASSWORD_FIELD, hash)
      .return(userId));
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
 * Public API
 */
module.exports = updatePassword;
module.exports.updatePassword = setPassword;
module.exports.transports = [require('@microfleet/core').ActionTransport.amqp];
