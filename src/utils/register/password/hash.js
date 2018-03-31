const generatePassword = require('./generate');
const is = require('is');
const Promise = require('bluebird');
const scrypt = require('../../scrypt');

/*
 * Returns the hashed password. If password equals `undefined` creates random password before
 * and send it to the user via challenge.
 */
function hashPassword(password, challengeType, emailOrPhone, ctx = {}) {
  const resolvedData = is.undefined(password) === true
    ? generatePassword.call(this, challengeType, emailOrPhone, ctx, { send: true })
    : password;

  return Promise
    .resolve(resolvedData)
    .then(scrypt.hash);
}

module.exports = hashPassword;
