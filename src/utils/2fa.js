const uuid = require('uuid/v4');
const { check } = require('otplib/authenticator');
const redisKey = require('./key');
const { hash } = require('./scrypt');
const {
  ErrorTotpRequired,
  ErrorTotpInvalid,
  USERS_2FA_SECRET,
  USERS_2FA_RECOVERY,
  ErrorAlreadyEnabled,
  Error2FADisabled,
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
    return true;
  }

  return false;
}

/**
 * Throws error if 2FA is enabled
 * @returns {null}
 */
async function throwIfEnabled() {
  const enabled = await is2FAEnabled.call(this);

  if (enabled) {
    throw ErrorAlreadyEnabled;
  }

  return null;
}

/**
 * Throws error if 2FA is disabled
 * @returns {null}
 */
async function throwIfDisabled() {
  const enabled = await is2FAEnabled.call(this);

  if (!enabled) {
    throw Error2FADisabled;
  }

  return null;
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

  // if user performs attach action we don't store secret yet
  // but user should provide it in params
  const secret = await redis.get(redisKey(USERS_2FA_SECRET, username)) || params.secret;

  // pass through if we don't have secret (2fa disabled)
  if (!secret) {
    return null;
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
module.exports.throwIfEnabled = throwIfEnabled;
module.exports.throwIfDisabled = throwIfDisabled;
module.exports.check2FA = check2FA;
