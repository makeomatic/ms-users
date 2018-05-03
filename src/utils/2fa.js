const Promise = require('bluebird');
const tfa = Promise.promisifyAll(require('2fa'));
const redisKey = require('./key');
const { USERS_2FA_RECOVERY, ErrorTotpInvalid } = require('../constants');

/**
 * Performs TOTP verification
 * @param  {string}  secret
 * @param  {string}  totp
 * @param  {string}  userId
 * @returns {Promise}
 */
module.exports.verifyTotp = function verifyTotp(secret, totp, userId) {
  // checks if totp is valid
  if (totp.length === 6 && !tfa.verifyTOTP(secret, totp)) {
    return Promise.reject(ErrorTotpInvalid);
  }

  const redisKeyRecovery = redisKey(USERS_2FA_RECOVERY, userId);

  // checks if user provided recovery code instead of totp
  return this.redis
    .sismember(redisKeyRecovery, totp)
    .then((yes) => {
      if (yes === 0) return Promise.reject(ErrorTotpInvalid);

      return this.redis.srem(redisKeyRecovery, totp);
    });
};

/**
 * Generates recovery codes
 * @param  {number}  count
 * @returns {Promise}
 */
module.exports.generateRecoveryCodes = function generateRecoveryCodes(count) {
  return tfa.generateBackupCodesAsync(count || 10);
};
