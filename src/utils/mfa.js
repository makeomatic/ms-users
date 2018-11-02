const Promise = require('bluebird');
const assert = require('assert');
const uuid = require('uuid/v4');
const authenticator = require('otplib/authenticator');
const crypto = require('crypto');
const { HttpStatusError } = require('common-errors');
const { getUserId } = require('./userData');
const redisKey = require('./key');
const {
  ErrorTotpRequired,
  ErrorTotpInvalid,
  ErrorSecretRequired,
  USERS_DATA,
  USERS_MFA_FLAG,
  USERS_MFA_RECOVERY,
  MFA_TYPE_REQUIRED,
  MFA_TYPE_OPTIONAL,
  MFA_TYPE_DISABLED,
} = require('../constants');

const is404 = e => parseInt(e.message, 10) === 404;
authenticator.options = { crypto };

/**
 * Generates recovery codes
 * @param  {number}  length
 * @returns {Array}
 */
function generateRecoveryCodes(length = 10) {
  return Array.from({ length }, () => uuid());
}

/**
 * Checks if MFA is enabled
 * @returns {Boolean}
 */
async function isMFAEnabled(userId) {
  const secret = await this.redis
    .hget(redisKey(userId, USERS_DATA), USERS_MFA_FLAG);

  if (secret) {
    return secret;
  }

  return false;
}

/**
 * Performs MFA check and TOTP verification
 * @param  {Object}  request
 * @returns {null}
 */
async function checkMFA({
  action,
  params = Object.create(null),
  locals = Object.create(null),
  headers = Object.create(null),
}) {
  if (!action.mfa) {
    return null;
  }

  let secret;
  const { redis } = this;
  const { username } = locals;
  const totp = params.totp || headers['x-auth-totp'];

  const userId = await Promise
    .bind(this, username)
    .then(getUserId)
    .catchReturn(is404, null);

  if (userId === null) {
    secret = null;
  } else {
    // checks if MFA is already enabled
    secret = await Promise.bind(this, userId).then(isMFAEnabled);
  }

  if (!secret) {
    // MFA is not enabled but is optional, pass through
    if (action.mfa === MFA_TYPE_OPTIONAL) {
      return null;
    }

    // MFA is not enabled but is required, throw
    if (action.mfa === MFA_TYPE_REQUIRED) {
      throw new HttpStatusError(412, 'MFA disabled');
    }

    // if we reached this point MFA is disabled
    // and action.mfa === 'disabled'
    // so user must provide secret in request
    secret = params.secret;
  } else if (action.mfa === MFA_TYPE_DISABLED) {
    // MFA is enabled but should be disabled, throw
    throw new HttpStatusError(409, 'MFA already enabled');
  }

  // if still no secret we can't perform futher checks
  assert(secret, ErrorSecretRequired);
  assert(totp, ErrorTotpRequired);

  // totp value is 6-digits means user
  // provided totp (not recovery code)
  if (totp.length === 6) {
    // valid, pass through
    assert(authenticator.check(totp, secret), ErrorTotpInvalid);
    return null;
  }

  // non 6-digits totp value means user
  // may be provided recovery key in place of totp
  // user may provide recovery key instead of totp
  // check it by trying to remove from set of codes
  const deleted = await redis.srem(redisKey(userId, USERS_MFA_RECOVERY), totp);

  // if nothing has been removed means code
  // is invalid, throw error
  assert(deleted === 1, ErrorTotpInvalid);

  return null;
}

exports.generateRecoveryCodes = generateRecoveryCodes;
exports.isMFAEnabled = isMFAEnabled;
exports.checkMFA = checkMFA;
