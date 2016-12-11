const Promise = require('bluebird');
const Errors = require('common-errors');
const scrypt = require('../utils/scrypt.js');
const redisKey = require('../utils/key.js');
const jwt = require('../utils/jwt.js');
const moment = require('moment');
const isActive = require('../utils/isActive.js');
const isBanned = require('../utils/isBanned.js');
const getInternalData = require('../utils/getInternalData.js');
const handlePipeline = require('../utils/pipelineError.js');
const noop = require('lodash/noop');
const { USERS_ACTION_DISPOSABLE_PASSWORD } = require('../constants');

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
function login(request) {
  const config = this.config.jwt;
  const { redis, tokenManager } = this;
  const { isDisposablePassword, isSSO, password } = request.params;
  const { lockAfterAttempts, defaultAudience } = config;
  const audience = request.params.audience || defaultAudience;
  const remoteip = request.params.remoteip || false;
  const verifyIp = remoteip && lockAfterAttempts > 0;

  // references for data from login attempts
  let remoteipKey;
  let loginAttempts;

  function checkLoginAttempts(data) {
    const pipeline = redis.pipeline();
    const username = data.username;
    remoteipKey = redisKey(username, 'ip', remoteip);

    pipeline.incrby(remoteipKey, 1);
    if (config.keepLoginAttempts > 0) {
      pipeline.expire(remoteipKey, config.keepLoginAttempts);
    }

    return pipeline
      .exec()
      .then(handlePipeline)
      .spread(function incremented(incrementValue) {
        loginAttempts = incrementValue;
        if (loginAttempts > lockAfterAttempts) {
          const duration = moment().add(config.keepLoginAttempts, 'seconds').toNow(true);
          const msg = `You are locked from making login attempts for the next ${duration}`;
          throw new Errors.HttpStatusError(429, msg);
        }
      });
  }

  function verifyHash(data) {
    return scrypt.verify(data.password, password);
  }

  function verifyDisposablePassword(data) {
    return tokenManager.verify({
      action: USERS_ACTION_DISPOSABLE_PASSWORD,
      id: data.username,
      token: password,
    });
  }

  function getVerifyStrategy() {
    if (isSSO === true) {
      return noop;
    }

    if (isDisposablePassword === true) {
      return verifyDisposablePassword;
    }

    return verifyHash;
  }

  function dropLoginCounter() {
    loginAttempts = 0;
    return redis.del(remoteipKey);
  }

  function getUserInfo({ username }) {
    return jwt.login.call(this, username, audience);
  }

  function enrichError(err) {
    if (remoteip) {
      err.loginAttempts = loginAttempts;
    }

    throw err;
  }

  return Promise
    .bind(this, request.params.username)
    .then(getInternalData)
    .tap(verifyIp ? checkLoginAttempts : noop)
    .tap(getVerifyStrategy())
    .tap(verifyIp ? dropLoginCounter : noop)
    .tap(isActive)
    .tap(isBanned)
    .then(getUserInfo)
    .catch(verifyIp ? enrichError : (e) => { throw e; });
}

module.exports = login;
