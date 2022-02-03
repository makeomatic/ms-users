const { HttpStatusError } = require('common-errors');

const { ActionTransport } = require('../re-export');

const scrypt = require('../utils/scrypt');
const redisKey = require('../utils/key');
const jwt = require('../utils/jwt');
const { getInternalData } = require('../utils/userData');
const isActive = require('../utils/is-active');
const isBanned = require('../utils/is-banned');
const hasPassword = require('../utils/has-password');
const { getUserId } = require('../utils/userData');
const {
  USERS_DATA,
  USERS_ACTION_RESET,
  USERS_PASSWORD_FIELD,
  USERS_ID_FIELD,
} = require('../constants');
const UserLoginRateLimiter = require('../utils/rate-limiters/user-login-rate-limiter');

// cache error
const Forbidden = new HttpStatusError(403, 'invalid token');

/**
 * Verify that username and password match
 * @param {Object} service
 * @param {String} username
 * @param {String} password
 */
async function usernamePasswordReset(service, username, password) {
  const internalData = await getInternalData.call(service, username);

  await isActive(internalData);
  await isBanned(internalData);
  await hasPassword(internalData);

  await scrypt.verify(internalData.password, password);

  return internalData[USERS_ID_FIELD];
}

/**
 * Sets new password for a given username
 * @param {Object} service
 * @param {String} userId
 * @param {String} password
 */
async function setPassword(service, userId, password) {
  const { redis } = service;
  const hash = await scrypt.hash(password);

  return redis.hset(redisKey(userId, USERS_DATA), USERS_PASSWORD_FIELD, hash);
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
async function updatePassword(request) {
  const { config, redis, tokenManager } = this;
  const { newPassword: password, remoteip = false } = request.params;
  const invalidateTokens = !!request.params.invalidateTokens;
  const loginRateLimiter = new UserLoginRateLimiter(redis, config.rateLimiters.userLogin);

  let userId;

  // 2 cases - token reset and current password reset
  if (request.params.resetToken) {
    try {
      const tokenData = await tokenManager.verify(request.params.resetToken, {
        erase: true,
        control: { action: USERS_ACTION_RESET },
      });

      // get real user id
      userId = await getUserId.call(this, tokenData.id);
    } catch (e) {
      throw Forbidden;
    }
  } else {
    userId = await usernamePasswordReset(this, request.params.username, request.params.currentPassword);
  }

  // update password
  await setPassword(this, userId, password);

  if (invalidateTokens) {
    await jwt.reset(userId);
  }

  if (remoteip !== false && loginRateLimiter.isEnabled()) {
    await loginRateLimiter.cleanupForUserIp(userId, remoteip);
  }

  return { success: true };
}

module.exports = updatePassword;
module.exports.updatePassword = setPassword;
module.exports.transports = [ActionTransport.amqp];
