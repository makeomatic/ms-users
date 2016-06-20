const Promise = require('bluebird');
const scrypt = require('../utils/scrypt.js');
const jwt = require('../utils/jwt.js');
const emailChallenge = require('../utils/send-email.js');

const isActive = require('../utils/isActive');
const isBanned = require('../utils/isBanned');

const { User, Attempts } = require('../model/usermodel');
const { httpErrorMapper } = require('../model/modelError');


/**
 * Verifies token and deletes it if it matches
 * @param {Strong} token
 */
function tokenReset(token) {
  return emailChallenge.verify.call(this, token, 'reset', true);
}

/**
 * Verify that username and password match
 * @param {String} username
 * @param {String} password
 */
function usernamePasswordReset(username, password) {
  return Promise
    .bind(this, username)
    .then(User.getOne)
    .tap(isActive)
    .tap(isBanned)
    .tap(data => scrypt.verify(data.password, password))
    .return(username)
    .catch(e => { throw httpErrorMapper(e); });
}

/**
 * Sets new password for a given username
 * @param {String} username
 * @param {String} password
 */
function setPassword(_username, password) {
  return Promise
    .bind(this, _username)
    .then(User.getUsername)
    .then(username => Promise.props({
      username,
      hash: scrypt.hash(password),
    }))
    .then(User.setPassword)
    .catch(e => { throw httpErrorMapper(e); });
}

module.exports = exports = function updatePassword(opts) {
  const { newPassword: password, remoteip } = opts;
  const invalidateTokens = !!opts.invalidateTokens;

  // 2 cases - token reset and current password reset
  let promise;
  if (opts.resetToken) {
    promise = tokenReset.call(this, opts.resetToken);
  } else {
    promise = usernamePasswordReset.call(this, opts.username, opts.currentPassword);
  }

  // update password
  promise = promise
    .then(username => setPassword.call(this, username, password));

  if (invalidateTokens) {
    promise = promise.tap(username => jwt.reset.call(this, username));
  }

  if (remoteip) {
    promise = promise.tap(function resetLock(username) {
      return Attempts.drop(username, remoteip);
    });
  }

  return promise.return({ success: true });
};

/**
 * Update password handler
 */
exports.updatePassword = setPassword;
