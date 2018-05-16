const uuid = require('uuid/v4');
const { check } = require('otplib/authenticator');
const { HttpStatusError } = require('common-errors');
const redisKey = require('./key');
const { hash } = require('./scrypt');
const {
  ErrorTotpRequired,
  ErrorTotpInvalid,
  USERS_2FA_SECRET,
  USERS_2FA_RECOVERY,
} = require('../constants');

/**
 * Generates recovery codes
 * @param  {number}  length
 * @returns {Array}
 */
function generateRecoveryCodes(length = 10) {
  return Array.from({ length }, () => uuid());
}

/**
 * Checks if 2FA is enabled
 * @returns {Boolean}
 */
async function is2FAEnabled() {
  const { redis, username } = this;
  const secret = await redis.get(redisKey(USERS_2FA_SECRET, username));

  if (secret) {
    return secret;
  }

  return false;
}

/**
 * Performs 2fa check and TOTP verification
 * @param  {Object}  request
 * @returns {null}
 */
async function check2FA({ action, params, headers }) {
  if (!action.tfa) {
    return null;
  }

  const { username } = params;
  const { redis } = this;

  // checks if 2FA is already enabled
  let secret = await is2FAEnabled.call(this);

  if (!secret) {
    // 2FA is not enabled but is optional, pass through
    if (action.tfa === 'optional') {
      return null;
    }

    // 2FA is not enabled but is required, throw
    if (action.tfa === 'required') {
      throw new HttpStatusError(412, '2FA disabled');
    }

    // if we reached this point 2FA is disabled
    // and action.2fa === 'disabled'
    // so user must provide secret in request
    secret = params.secret;
  } else if (action.tfa === 'disabled') {
    // 2FA is enabled but should be disabled, throw
    throw new HttpStatusError(409, '2FA already enabled');
  }

  // if still no secret we can't perform futher checks
  if (!secret) {
    throw new HttpStatusError(403, 'Secret required');
  }

  const totp = params.totp || headers['X-Auth-TOTP'];

  if (!totp) {
    throw ErrorTotpRequired;
  }

  // if totp value is 6-digits and invalid throw error
  if (totp.length === 6 && !check(totp, secret)) {
    throw ErrorTotpInvalid;
  }

  // istead of 6-digits totp user may provide
  // recovery code, calculate it hash
  const recoveryHash = await hash(totp);

  // and try to remove it from array of hashed codes
  const deleted = await redis
    .srem(redisKey(USERS_2FA_RECOVERY, username), recoveryHash);

  // if nothing has been removed means code is invalid, throw error
  if (deleted === 0) {
    throw ErrorTotpInvalid;
  }

  return null;
}

module.exports.generateRecoveryCodes = generateRecoveryCodes;
module.exports.is2FAEnabled = is2FAEnabled;
module.exports.check2FA = check2FA;
