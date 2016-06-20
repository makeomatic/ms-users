const Promise = require('bluebird');
const scrypt = require('../utils/scrypt.js');
const jwt = require('../utils/jwt.js');
const noop = require('lodash/noop');
const isActive = require('../utils/isActive');
const isBanned = require('../utils/isBanned');
const { User, Attempts } = require('../model/usermodel');
const { httpErrorMapper } = require('../model/modelError');

module.exports = function login(opts) {
  const config = this.config.jwt;
  const { password } = opts;
  const { lockAfterAttempts, defaultAudience } = config;
  const audience = opts.audience || defaultAudience;
  const remoteip = opts.remoteip || false;
  const verifyIp = remoteip && lockAfterAttempts > 0;

  function verifyHash(data) {
    const { password: hash } = data;
    return scrypt.verify(hash, password);
  }

  function getUserInfo({ username }) {
    return jwt.login.call(this, username, audience);
  }

  function enrichError(err) {
    if (remoteip) {
      err.loginAttempts = Attempts.count();
    }

    return err;
  }

  return Promise
    .bind(this, opts.username)
    .then(User.getOne)
    .then(data => [data, remoteip])
    .tap(verifyIp ? Attempts.check : noop)
    .tap(verifyHash)
    .tap(verifyIp ? Attempts.drop : noop)
    .tap(isActive)
    .tap(isBanned)
    .then(getUserInfo)
    .catch(e => { throw httpErrorMapper(verifyIp ? enrichError(e) : e); });
};
