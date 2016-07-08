const Promise = require('bluebird');
const scrypt = require('../utils/scrypt.js');
const jwt = require('../utils/jwt.js');
const noop = require('lodash/noop');
const isActive = require('../utils/isActive');
const isBanned = require('../utils/isBanned');
const { User, Attempts } = require('../model/usermodel');

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
module.exports = function login(opts) {
  const config = this.config.jwt;
  const { password } = opts;
  const { lockAfterAttempts, defaultAudience } = config;
  const audience = opts.audience || defaultAudience;
  const remoteip = opts.remoteip || false;
  const verifyIp = remoteip && lockAfterAttempts > 0;

  const theAttempts = new Attempts(this);

  function verifyHash(data) {
    return scrypt.verify(data.password, password);
  }

  function getUserInfo({ username }) {
    return jwt.login.call(this, username, audience);
  }

  return Promise
    .bind(this, opts.username)
    .then(User.getOne)
    .then(data => ({ ...data, remoteip }))
    .tap(verifyIp ? ({ username, ip }) => theAttempts.check(username, ip) : noop)
    .tap(verifyHash)
    .tap(verifyIp ? ({ username, ip }) => theAttempts.drop(username, ip) : noop)
    .tap(isActive)
    .tap(isBanned)
    .then(getUserInfo);
};
