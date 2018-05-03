const Promise = require('bluebird');
const verify = require('2fa').verifyTOTP;
const { ErrorTotpInvalid } = require('../constants');

/**
 * Performs TOTP verification
 * @param  {string}  secret
 * @param  {string}  totp
 * @param  {string}  recovery
 * @returns {Promise}
 */
module.exports.verifyTotp = function verifyTotp(secret, totp, recovery) {
  // checks if totp is valid or if user provided recovery code
  if (!verify(secret, totp) || totp === recovery) {
    return Promise.reject(ErrorTotpInvalid);
  }

  return null;
};
