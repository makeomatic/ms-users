const Promise = require('bluebird');
const Errors = require('common-errors');
const scrypt = require('../utils/scrypt.js');
const redisKey = require('../utils/key.js');
const jwt = require('../utils/jwt.js');
const moment = require('moment');
const isActive = require('../utils/isActive.js');
const isBanned = require('../utils/isBanned.js');
const getInternalData = require('../utils/getInternalData.js');
const noop = require('lodash/noop');

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
 *
 */
function login(request) {
  const config = this.config.jwt;
  const { redis } = this;
  const { password } = request.params;
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
      .spread(function incremented(incrementValue) {
        const err = incrementValue[0];
        if (err) {
          this.log.error('Redis error:', err);
          return;
        }

        loginAttempts = incrementValue[1];
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
    .tap(verifyHash)
    .tap(verifyIp ? dropLoginCounter : noop)
    .tap(isActive)
    .tap(isBanned)
    .then(getUserInfo)
    .catch(verifyIp ? enrichError : e => { throw e; });
}

module.exports = login;
