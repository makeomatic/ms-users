const Promise = require('bluebird');
const tfa = Promise.promisifyAll(require('2fa'));
const redisKey = require('./key');
const { USERS_2FA_RECOVERY, ErrorTotpInvalid } = require('../constants');

/**
 * Performs TOTP verification
 * @param  {string}  secret
 * @returns {Promise}
 */
module.exports.verifyTotp = function verifyTotp(secret) {
  const { redis, username, totp } = this;

  // checks if totp is valid
  if (totp.length === 6 && !tfa.verifyTOTP(secret, totp)) {
    return Promise.reject(ErrorTotpInvalid);
  }

  const redisKeyRecovery = redisKey(USERS_2FA_RECOVERY, username);

  return redis.srem(redisKeyRecovery, totp)
    .catch({ message: 404 }, () => {
      return Promise.reject(ErrorTotpInvalid);
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
