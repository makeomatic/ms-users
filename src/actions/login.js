const Promise = require('bluebird');
const scrypt = require('../utils/scrypt.js');
const jwt = require('../utils/jwt.js');
const noop = require('lodash/noop');

const Users = require('../db/adapter');


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
      err.loginAttempts = Users.getAttempts();
    }

    throw err;
  }

  return Promise
    .bind(this, opts.username)
    .then(Users.getUser)
    .then(data => [data, remoteip])
    .tap(verifyIp ? Users.checkLoginAttempts : noop)
    .tap(verifyHash)
    .tap(verifyIp ? Users.dropAttempts : noop)
    .tap(Users.isActive)
    .tap(Users.isBanned)
    .then(getUserInfo)
    .catch(verifyIp ? enrichError : e => { throw e; });
};
