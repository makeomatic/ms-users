const { ActionTransport } = require('@microfleet/core');
const assert = require('assert');
const uuid = require('uuid/v4');
const authenticator = require('otplib/authenticator');
const crypto = require('crypto');
const { HttpStatusError } = require('common-errors');
const { getInternalData } = require('./userData');
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
async function checkMFA(request) {
  const {
    action,
    transport,
    params,
    headers,
  } = request;

  if (!action.mfa) {
    return null;
  }

  if (!request.locals) {
    request.locals = Object.create(null);
  }

  let username;
  if (transport === ActionTransport.http) {
    username = request.auth.credentials.id;
  } else if (params.username) {
    username = params.username;
  } else {
    throw new HttpStatusError(400, 'no username source');
  }

  const { locals } = request;
  const { redis } = this;
  const totp = (params && params.totp) || (headers && headers['x-auth-totp']);

  try {
    locals.internalData = await getInternalData.call(this, username);
    locals.username = locals.internalData.id;
  } catch (e) {
    if (action.mfa === MFA_TYPE_OPTIONAL) {
      return null;
    }

    throw e;
  }

  let secret = locals.internalData[USERS_MFA_FLAG];
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
  const deleted = await redis.srem(redisKey(locals.username, USERS_MFA_RECOVERY), totp);

  // if nothing has been removed means code
  // is invalid, throw error
  assert(deleted === 1, ErrorTotpInvalid);

  return null;
}

exports.generateRecoveryCodes = generateRecoveryCodes;
exports.isMFAEnabled = isMFAEnabled;
exports.checkMFA = checkMFA;
