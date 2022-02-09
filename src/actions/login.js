const Promise = require('bluebird');
const { HttpStatusError } = require('common-errors');
const moment = require('moment');
const is = require('is');
const { ActionTransport } = require('@microfleet/plugin-router');

const scrypt = require('../utils/scrypt');
const jwt = require('../utils/jwt');
const isActive = require('../utils/is-active');
const isBanned = require('../utils/is-banned');

const { checkMFA } = require('../utils/mfa');
const { verifySignedToken } = require('../auth/oauth/utils/get-signed-token');

const UserLoginRateLimiter = require('../utils/rate-limiters/user-login-rate-limiter');
const { STATUS_FOREVER } = require('../utils/sliding-window-limiter/redis');

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

const handleRateLimitError = (error) => {
  let message;
  if (error instanceof UserLoginRateLimiter.RateLimitError) {
    if (error.reset === STATUS_FOREVER) {
      message = `You are locked from making login attempts forever from ipaddress '${error.ip}'`;
    } else {
      const duration = moment().add(error.reset, 'milliseconds').toNow(true);
      message = `You are locked from making login attempts for ${duration} from ipaddress '${error.ip}'`;
    }
    throw new HttpStatusError(429, message);
  }

  throw error;
};

/**
 * Increments login attempts counter or throws if limit is reached
 */
const checkLoginAttempts = async (ctx, data) => {
  if (!ctx.rateLimiterEnabled) {
    return;
  }

  const userId = data[USERS_ID_FIELD];

  try {
    await ctx.loginRateLimiter.reserveForUserIp(userId, ctx.remoteip);
  } catch (e) {
    handleRateLimitError(e);
  }
};

/**
 * Drops login limiter tokens
 */
const cleanupRateLimits = async (ctx, internalData) => {
  if (!ctx.rateLimiterEnabled) {
    return;
  }

  await ctx.loginRateLimiter
    .cleanupForUserIp(internalData[USERS_ID_FIELD], ctx.remoteip);
};

/**
 * Verifies passed hash
 */
const verifyHash = ({ password }, comparableInput) => {
  return scrypt.verify(password, comparableInput);
};

const verifyOAuthToken = async (ctx, { id }, token) => {
  const providerData = await verifySignedToken.call(ctx.service, token);

  if (providerData.profile.userId !== id) {
    throw USERS_INVALID_TOKEN;
  }

  return true;
};

/**
 * Checks onу-time password
 */
const verifyDisposablePassword = async (ctx, data) => {
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
};

/**
 * Determines which strategy to use
 */
const performAuthentication = async (ctx, data) => {
  if (ctx.isSSO === true) {
    return null;
  }

  if (is.string(ctx.password) !== true || ctx.password.length < 1) {
    throw new HttpStatusError(400, 'should supply password');
  }

  if (ctx.isDisposablePassword === true) {
    return verifyDisposablePassword(ctx, data);
  }

  if (ctx.isOAuthFollowUp === true) {
    return verifyOAuthToken(ctx, data, ctx.password);
  }

  return verifyHash(data, ctx.password);
};

/**
 * Returns user info
 */
const getUserInfo = async (ctx, internalData) => {
  const datum = await Promise
    .bind(ctx.service, [internalData.id, ctx.audience])
    .spread(jwt.login);

  // NOTE: transformed to boolean
  datum.mfa = !!internalData[USERS_MFA_FLAG];

  return datum;
};

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
  const { redis, tokenManager, config } = this;
  const { jwt: { defaultAudience }, rateLimiters: rateLimitersConfig } = config;
  const { isOAuthFollowUp, isDisposablePassword, isSSO, password, audience = defaultAudience, remoteip = false } = params;
  const loginRateLimiter = new UserLoginRateLimiter(redis, rateLimitersConfig.userLogin);
  const rateLimiterEnabled = remoteip !== false && loginRateLimiter.isEnabled();

  const ctx = {
    service: this,
    tokenManager,
    redis,
    config,
    loginRateLimiter,
    params,
    isOAuthFollowUp,
    isDisposablePassword,
    isSSO,
    password,
    audience,
    remoteip,
    rateLimiterEnabled,
  };

  if (rateLimiterEnabled) {
    try {
      await loginRateLimiter.reserveForIp(remoteip);
    } catch (e) {
      handleRateLimitError(e);
    }
  }

  const { internalData } = locals;

  // verify that locals.internalData exists
  if (!internalData) {
    throw ErrorUserNotFound;
  }

  // check login attempts from passed ipaddress or noop
  await checkLoginAttempts(ctx, internalData);

  // selects auth strategy and verifies passed data
  await performAuthentication(ctx, internalData);

  // cleans up counters in case of success
  await cleanupRateLimits(ctx, internalData);

  // verifies that the user is active, rejects by default
  await isActive(internalData);

  // verifies that user is not banned, sync action - throws
  isBanned(internalData);

  // retrieves complete information and returns it
  const userInfo = await getUserInfo(ctx, internalData);

  await this.hook('users:login', userInfo, ctx);

  return userInfo;
}

login.mfa = MFA_TYPE_OPTIONAL;
login.allowed = checkMFA;
login.transports = [ActionTransport.amqp, ActionTransport.internal];

module.exports = login;
