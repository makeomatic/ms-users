const Promise = require('bluebird');
const authenticator = require('otplib/authenticator');
const uuid = require('uuid/v4');
const redisKey = require('./key');
const { hash } = require('./scrypt');
const { USERS_2FA_RECOVERY, ErrorTotpInvalid } = require('../constants');

/**
 * Performs TOTP verification
 * @param  {string}  secret
 * @returns {Promise}
 */
module.exports.verifyTotp = function verifyTotp(secret) {
  const { redis, username, totp } = this;

  // checks if totp is valid
  if (totp.length === 6 && !authenticator.check(totp, secret)) {
    return Promise.reject(ErrorTotpInvalid);
  }

  const redisKeyRecovery = redisKey(USERS_2FA_RECOVERY, username);

  return hash(totp)
    .then(recoveryHash => redis.srem(redisKeyRecovery, recoveryHash))
    .catch({ message: 404 }, () => {
      return Promise.reject(ErrorTotpInvalid);
    });
};

/**
 * Generates recovery codes
 * @param  {number}  count
 * @returns {Promise}
 */
module.exports.generateRecoveryCodes = function generateRecoveryCodes(count = 10) {
  const codes = new Array(count);

  for (let i = 0; i < count; i += 1) {
    codes[i] = uuid();
  }

  return codes;
};
