const { ActionTransport } = require('@microfleet/core');
const Promise = require('bluebird');
const Errors = require('common-errors');
const moment = require('moment');
const noop = require('lodash/noop');
const is = require('is');
const scrypt = require('../utils/scrypt.js');
const redisKey = require('../utils/key.js');
const jwt = require('../utils/jwt.js');
const isActive = require('../utils/isActive.js');
const isBanned = require('../utils/isBanned.js');
const { getInternalData } = require('../utils/userData');
const handlePipeline = require('../utils/pipelineError.js');
const {
  USERS_ACTION_DISPOSABLE_PASSWORD,
  USERS_DISPOSABLE_PASSWORD_MIA,
  USERS_ID_FIELD,
  USERS_USERNAME_FIELD,
} = require('../constants');

/**
 * Internal functions
 */
const is404 = e => parseInt(e.message, 10) === 404;
const isHttp404 = e => e.statusCode === 404;

const globalLoginAttempts = async (ctx) => {
  const { config } = ctx;
  const pipeline = ctx.redis.pipeline();
  const globalRemoteIpKey = ctx.globalRemoteIpKey = redisKey('gl!ip!ctr', ctx.remoteip);

  pipeline.incrby(globalRemoteIpKey, 1);

  if (config.keepGlobalLoginAttempts > 0) {
    pipeline.expire(globalRemoteIpKey, config.keepGlobalLoginAttempts);
  }

  const [globalAttempts] = await pipeline.exec().then(handlePipeline);

  ctx.globalLoginAttempts = globalAttempts;

  // globally scoped go next
  if (globalAttempts > ctx.globalLockAfterAttempts) {
    const duration = moment().add(config.keepGlobalLoginAttempts, 'seconds').toNow(true);
    const msg = `You are locked from making login attempts for the next ${duration}`;
    throw new Errors.HttpStatusError(429, msg);
  }
};

const localLoginAttempts = async (ctx, data) => {
  const { config } = ctx;
  const pipeline = ctx.redis.pipeline();
  const userId = data[USERS_ID_FIELD];
  const remoteipKey = ctx.remoteipKey = redisKey(userId, 'ip', ctx.remoteip);

  pipeline.incrby(remoteipKey, 1);

  if (config.keepLoginAttempts > 0) {
    pipeline.expire(remoteipKey, config.keepLoginAttempts);
  }

  const [scopeAttempts] = await pipeline.exec().then(handlePipeline);

  ctx.loginAttempts = scopeAttempts;

  // locally scoped login attempts are prioritized
  if (scopeAttempts > ctx.lockAfterAttempts) {
    const duration = moment().add(config.keepLoginAttempts, 'seconds').toNow(true);
    const msg = `You are locked from making login attempts for the next ${duration}`;
    throw new Errors.HttpStatusError(429, msg);
  }
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

/**
 * Checks onу-time password
 */
function verifyDisposablePassword(ctx, data) {
  return ctx
    .tokenManager
    .verify({
      action: USERS_ACTION_DISPOSABLE_PASSWORD,
      id: data[USERS_USERNAME_FIELD],
      token: ctx.password,
    })
    .catchThrow(is404, USERS_DISPOSABLE_PASSWORD_MIA);
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

  return verifyHash(data, this.password);
}

/**
 * Drops login attempts counter
 */
function dropLoginCounter() {
  this.loginAttempts = 0;

  return this.redis
    .pipeline()
    .del(this.remoteipKey)
    .incrby(this.globalRemoteIpKey, -1)
    .exec()
    .then(handlePipeline);
}

/**
 * Returns user info
 */
function getUserInfo({ id }) {
  return jwt.login.call(this.service, id, this.audience);
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
function login({ params }) {
  const config = this.config.jwt;
  const { redis, tokenManager } = this;
  const { isDisposablePassword, isSSO, password } = params;
  const { lockAfterAttempts, globalLockAfterAttempts, defaultAudience } = config;
  const audience = params.audience || defaultAudience;
  const remoteip = params.remoteip || false;
  const verifyIp = remoteip && lockAfterAttempts > 0;

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
    isDisposablePassword,
    isSSO,
    password,
    lockAfterAttempts,
    globalLockAfterAttempts,
    audience,
    remoteip,
    verifyIp,
  };

  return Promise
    // service context
    .bind(this, params.username)
    // resolve alias/email/phone to internal id
    .then(getInternalData)
    // login context
    .bind(ctx)
    // record global login attempt even on 404
    .tapCatch(isHttp404, verifyIp ? checkLoginAttempts : noop)
    // pass-through based on strategy
    .tap(verifyIp ? checkLoginAttempts : noop)
    // different auth strategies
    .tap(getVerifyStrategy)
    // pass-through or drop counter
    .tap(verifyIp ? dropLoginCounter : noop)
    // do verifications on the logged in account
    .tap(isActive)
    .tap(isBanned)
    // fetch final user information
    .then(getUserInfo)
    // enriches and rethrows
    .catch(enrichError);
}

login.transports = [ActionTransport.amqp, ActionTransport.internal];

module.exports = login;
