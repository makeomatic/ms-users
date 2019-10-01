const { ActionTransport } = require('@microfleet/core');
const Promise = require('bluebird');
const Errors = require('common-errors');
const moment = require('moment');
const noop = require('lodash/noop');
const is = require('is');
const scrypt = require('../utils/scrypt');
const jwt = require('../utils/jwt');
const isActive = require('../utils/is-active');
const isBanned = require('../utils/is-banned');

const { checkMFA } = require('../utils/mfa');
const { verifySignedToken } = require('../auth/oauth/utils/get-signed-token');
const { RateLimitError } = require('../utils/sliding-window/limiter.js');

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

/**
 * Prettifies interval
 * Returns human-readable string
 * @param interval - milliseconds
 * @returns {string}
 */
const getHMRDuration = (interval) => {
  if (interval === 0) {
    return 'forever';
  }
  const duration = moment().add(interval, 'seconds').toNow(true);
  return `for the next ${duration}`;
};

const globalLoginAttempts = async (ctx) => {
  const { service } = ctx;
  const { rateLimiters } = service;
  const { loginGlobalIp } = rateLimiters;
  let token;

  try {
    ({ token } = await loginGlobalIp.reserve(ctx.remoteip));
  } catch (err) {
    if (err instanceof RateLimitError) {
      const duration = getHMRDuration(err.reset);
      const msg = `You are locked from making login attempts ${duration} from ipaddress '${ctx.remoteip}'`;
      ctx.globalLoginAttempts = err.usage;

      throw new Errors.HttpStatusError(429, msg);
    }

    throw err;
  }
  ctx.globalLoginAttemptToken = token;
};

const localLoginAttempts = async (ctx, data) => {
  const { service } = ctx;
  const { rateLimiters } = service;
  const { loginUserIp } = rateLimiters;
  const userId = data[USERS_ID_FIELD];
  let token;

  try {
    ({ token } = await loginUserIp.reserve(userId, ctx.remoteip));
  } catch (err) {
    if (err instanceof RateLimitError) {
      ctx.loginAttempts = err.usage;
      const duration = getHMRDuration(err.reset);
      const msg = `You are locked from making login attempts ${duration} from ipaddress '${ctx.remoteip}'`;
      throw new Errors.HttpStatusError(429, msg);
    }
    throw err;
  }

  ctx.loginUserId = userId;
  ctx.localLoginAttemptToken = token;
};

/**
 * Checks if login attempts from remote ip have exceeded allowed
 * limits
 */
async function checkLoginAttempts(dataOrError) {
  const promises = [globalLoginAttempts(this)];

  if ((dataOrError instanceof Error) === false) {
    promises.push(localLoginAttempts(this, dataOrError));
  }

  await Promise.all(promises);
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
async function cancelReservedLoginAttempts() {
  const {
    service,
    remoteip,
    loginUserId,
    globalLoginAttemptToken,
    localLoginAttemptToken,
  } = this;

  const { loginGlobalIp, loginUserIp } = service.rateLimiters;

  const work = [
    loginGlobalIp.cancel(remoteip, globalLoginAttemptToken),
    loginUserId ? loginUserIp.cancel(loginUserId, remoteip, localLoginAttemptToken) : noop,
  ];
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
function login({ params, locals }) {
  const config = this.config.jwt;
  const rateLimiterConfig = this.config.rateLimiters;
  const { loginGlobalIp, loginUserIp } = rateLimiterConfig;
  const { redis, tokenManager } = this;
  const { isOAuthFollowUp, isDisposablePassword, isSSO, password } = params;
  const { defaultAudience } = config;
  const audience = params.audience || defaultAudience;
  const remoteip = params.remoteip || false;
  const rateLimiterEnabled = loginGlobalIp.limit > 0 || loginUserIp.limit > 0;
  const verifyIp = remoteip && rateLimiterEnabled;

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

    // business logic params
    params,
    isOAuthFollowUp,
    isDisposablePassword,
    isSSO,
    password,
    audience,
    remoteip,
    verifyIp,
  };

  return Promise
    .bind(ctx, locals.internalData)
    // verify that locals.internalData exists
    .tap(verifyInternalData)
    // record global login attempt even on 404
    .tapCatch(verifyIp ? checkLoginAttempts : noop)
    .tap(verifyIp ? checkLoginAttempts : noop)
    // different auth strategies
    .tap(getVerifyStrategy)
    // pass-through or drop counter
    .tap(verifyIp ? cancelReservedLoginAttempts : noop)
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
