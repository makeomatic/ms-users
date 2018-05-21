const Promise = require('bluebird');
const uuid = require('uuid/v4');
const authenticator = require('otplib/authenticator');
const crypto = require('crypto');
const { HttpStatusError } = require('common-errors');
const redisKey = require('./key');
const { verify } = require('./scrypt');
const {
  ErrorTotpRequired,
  ErrorTotpInvalid,
  USERS_2FA_SECRET,
  USERS_2FA_RECOVERY,
  TFA_TYPE_REQUIRED,
  TFA_TYPE_OPTIONAL,
  TFA_TYPE_DISABLED,
} = require('../constants');

authenticator.options = { crypto };

const verifyToken = totp => token =>
  verify(Buffer.from(token, 'hex'), totp)
    .return(token);

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
async function is2FAEnabled(username) {
  const { redis } = this;

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
  let secret = await is2FAEnabled.call(this, username);

  if (!secret) {
    // 2FA is not enabled but is optional, pass through
    if (action.tfa === TFA_TYPE_OPTIONAL) {
      return null;
    }

    // 2FA is not enabled but is required, throw
    if (action.tfa === TFA_TYPE_REQUIRED) {
      throw new HttpStatusError(412, '2FA disabled');
    }

    // if we reached this point 2FA is disabled
    // and action.2fa === 'disabled'
    // so user must provide secret in request
    secret = params.secret;
  } else if (action.tfa === TFA_TYPE_DISABLED) {
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

  // totp value is 6-digits means user
  // provided totp (not recovery code)
  if (totp.length === 6) {
    // valid, pass through
    if (authenticator.check(totp, secret)) {
      return null;
    }

    // invalid, throw
    throw ErrorTotpInvalid;
  }

  // get all recovery codes hashes
  const redisKeyRecovery = redisKey(USERS_2FA_RECOVERY, username);
  const hashes = await redis.smembers(redisKeyRecovery);

  // check if one of them is valid
  const validHash = await Promise
    .any(hashes.map(verifyToken(totp)))
    .catch(() => {
      throw ErrorTotpInvalid;
    });

  // and try to remove valid hash from array of hashes
  const deleted = await redis.srem(redisKeyRecovery, validHash);

  // if nothing has been removed means code is invalid, throw error
  if (deleted === 0) {
    throw ErrorTotpInvalid;
  }

  return null;
}

module.exports.generateRecoveryCodes = generateRecoveryCodes;
module.exports.is2FAEnabled = is2FAEnabled;
module.exports.check2FA = check2FA;
