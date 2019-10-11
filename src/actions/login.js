const { ActionTransport } = require('@microfleet/core');
const Promise = require('bluebird');
const Errors = require('common-errors');
const moment = require('moment');
const is = require('is');
const scrypt = require('../utils/scrypt');
const jwt = require('../utils/jwt');
const isActive = require('../utils/is-active');
const isBanned = require('../utils/is-banned');

const { checkMFA } = require('../utils/mfa');
const { verifySignedToken } = require('../auth/oauth/utils/get-signed-token');

const UserIpRateLimiter = require('../utils/rate-limiters/user-ip-rate-limiter');
const { RateLimitError, STATUS_FOREVER } = require('../utils/sliding-window/rate-limiter');

const {
  USERS_ACTION_DISPOSABLE_PASSWORD,
  USERS_DISPOSABLE_PASSWORD_MIA,
  USERS_ID_FIELD,
  USERS_USERNAME_FIELD,
  USERS_MFA_FLAG,
  MFA_TYPE_OPTIONAL,
  USERS_INVALID_TOKEN,
  ErrorUserNotFound,
} = require('../constants');

/**
 * Internal functions
 */
const is404 = (e) => parseInt(e.message, 10) === 404;

function newRateLimitHTTPError(error, ip) {
  let message;

  if (error.reset === STATUS_FOREVER) {
    message = `You are locked from making login attempts forever from ipaddress '${ip}'`;
  } else {
    const duration = moment().add(error.reset, 'milliseconds').toNow(true);
    message = `You are locked from making login attempts for the next ${duration} from ipaddress '${ip}'`;
  }

  throw new Errors.HttpStatusError(429, message);
}

async function checkLoginAttempts(data) {
  const { loginIpRateLimiter, remoteip } = this;

  const userId = data[USERS_ID_FIELD];

  if (remoteip && loginIpRateLimiter.isUserIpRateLimiterEnabled()) {
    await loginIpRateLimiter
      .reserveForUserIp(userId, remoteip)
      .catch((err) => {
        if (err instanceof RateLimitError) {
          this.loginAttempts = err.usage;
          throw newRateLimitHTTPError(err, remoteip);
        }
        throw err;
      });

    this.loginUserId = userId;
  }
}

/**
 * Verifies passed hash
 */
function verifyHash({ password }, comparableInput) {
  return scrypt.verify(password, comparableInput);
}

async function verifyOAuthToken({ id }, token) {
  const providerData = await verifySignedToken.call(this, token);

  if (providerData.profile.userId !== id) {
    throw USERS_INVALID_TOKEN;
  }

  return true;
}

/**
 * Checks onу-time password
 */
async function verifyDisposablePassword(ctx, data) {
  try {
    return await ctx.tokenManager.verify({
      action: USERS_ACTION_DISPOSABLE_PASSWORD,
      id: data[USERS_USERNAME_FIELD],
      token: ctx.password,
    });
  } catch (e) {
    if (is404(e)) {
      throw USERS_DISPOSABLE_PASSWORD_MIA;
    }

    throw e;
  }
}

/**
 * Determines which strategy to use
 */
function getVerifyStrategy(data) {
  if (this.isSSO === true) {
    return null;
  }

  if (is.string(this.password) !== true || this.password.length < 1) {
    throw new Errors.HttpStatusError(400, 'should supply password');
  }

  if (this.isDisposablePassword === true) {
    return verifyDisposablePassword(this, data);
  }

  if (this.isOAuthFollowUp === true) {
    return verifyOAuthToken.call(this.service, data, this.password);
  }

  return verifyHash(data, this.password);
}

/**
 * Drops login limiter tokens
 */
async function cleanupRateLimits() {
  const {
    remoteip,
    loginUserId,
    loginIpRateLimiter,
  } = this;

  const work = [];

  if (remoteip && loginIpRateLimiter.isIpRateLimiterEnabled()) {
    work.push(loginIpRateLimiter.cleanupForIp(remoteip));
  }

  if (remoteip && loginIpRateLimiter.isUserIpRateLimiterEnabled()) {
    if ((loginUserId != null && typeof loginUserId !== 'undefined')) {
      work.push(loginIpRateLimiter.cleanupForUserIp(loginUserId, remoteip));
    }
  }

  return Promise.all(work);
}

/**
 * Returns user info
 */
async function getUserInfo(internalData) {
  const datum = await Promise
    .bind(this.service, [internalData.id, this.audience])
    .spread(jwt.login);

  // NOTE: transformed to boolean
  datum.mfa = !!internalData[USERS_MFA_FLAG];

  return datum;
}

/**
 * Enriches error with amount of login attempts
 */
function enrichError(err) {
  if (this.remoteip) {
    err.loginAttempts = this.loginAttempts;
    err.globalLoginAttempts = this.globalLoginAttempts;
  }

  throw err;
}

function verifyInternalData(data) {
  if (!data) throw ErrorUserNotFound;
}

/**
 * @api {amqp} <prefix>.login User Authentication
 * @apiVersion 1.0.0
 * @apiName LoginUser
 * @apiGroup Users
 *
 * @apiDescription Provides various strategies for user authentication. Returns signed JWT token that could be used
 * for state resolution and authorization, as well as user object
 *
 * @apiParam (Payload) {String} username - currently only email
 * @apiParam (Payload) {String} password - plain text password, will be compared to store hash
 * @apiParam (Payload) {String} audience - metadata to be returned, as well embedded into JWT token
 * @apiParam (Payload) {String} [remoteip] - security logging feature, not used
 * @apiParam (Payload) {String} [isDisposablePassword=false] - use disposable password for verification
 * @apiParam (Payload) {String} [isSSO=false] - verification was already performed by single sign on (ie, facebook)
 */
async function login({ params, locals }) {
  const config = this.config.jwt;
  const rateLimiterConfig = this.config.rateLimiters;
  const { redis, tokenManager } = this;
  const { isOAuthFollowUp, isDisposablePassword, isSSO, password } = params;
  const { defaultAudience } = config;
  const audience = params.audience || defaultAudience;
  const remoteip = params.remoteip || false;

  const loginIpRateLimiter = new UserIpRateLimiter(this.redis, rateLimiterConfig.userLogin);

  // build context
  const ctx = {
    // service data
    service: this,
    tokenManager,
    redis,
    config,
    // counters
    loginAttempts: 0,
    globalLoginAttempts: 0,
    loginIpRateLimiter,

    // business logic params
    params,
    isOAuthFollowUp,
    isDisposablePassword,
    isSSO,
    password,
    audience,
    remoteip,
  };

  if (remoteip && loginIpRateLimiter.isIpRateLimiterEnabled()) {
    await loginIpRateLimiter
      .reserveForIp(remoteip)
      .catch((err) => {
        if (err instanceof RateLimitError) {
          ctx.globalLoginAttempts = err.usage;
          throw newRateLimitHTTPError(err, remoteip);
        }
        throw err;
      });
  }

  return Promise
    .bind(ctx, locals.internalData)
    // verify that locals.internalData exists
    .tap(verifyInternalData)
    // check login attempts
    .tap(checkLoginAttempts)
    // different auth strategies
    .tap(getVerifyStrategy)
    // pass-through or drop counter
    .tap(cleanupRateLimits)
    // do verifications on the logged in account
    .tap(isActive)
    .tap(isBanned)
    // fetch final user information
    .then(getUserInfo)
    // enriches and rethrows
    .catch(enrichError);
}

login.mfa = MFA_TYPE_OPTIONAL;
login.allowed = checkMFA;
login.transports = [ActionTransport.amqp, ActionTransport.internal];

module.exports = login;
