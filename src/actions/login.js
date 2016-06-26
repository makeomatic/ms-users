const Promise = require('bluebird');
const scrypt = require('../utils/scrypt.js');
const jwt = require('../utils/jwt.js');
const noop = require('lodash/noop');
const isActive = require('../utils/isActive');
const isBanned = require('../utils/isBanned');
const { User, Attempts } = require('../model/usermodel');

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

  function enrichError(err) {
    if (remoteip) {
      err.loginAttempts = theAttempts.count();
    }

    return err;
  }

  return Promise
    .bind(this, opts.username)
    .then(User.getOne)
    .then(data => [data, remoteip])
    .tap(verifyIp ? ({ username, ip }) => theAttempts.check(username, ip) : noop)
    .tap(verifyHash)
    .tap(verifyIp ? (username, ip) => theAttempts.drop(username, ip) : noop)
    .tap(isActive)
    .tap(isBanned)
    .then(getUserInfo)
    .catch(verifyIp ? enrichError : e => { throw e; });
};
