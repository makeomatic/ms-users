const Promise = require('bluebird');
const scrypt = require('../utils/scrypt.js');
const jwt = require('../utils/jwt.js');
const emailChallenge = require('../utils/send-email.js');
const isActive = require('../utils/isActive');
const isBanned = require('../utils/isBanned');
const { User, Attempts } = require('../model/usermodel');


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
    .return(username);
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
    .then(User.setPassword);
}

/**
 * @api {amqp} <prefix>.updatePassword Update Password
 * @apiVersion 1.0.0
 * @apiName UpdatePassword
 * @apiGroup Users
 *
 * @apiDescription Allows one to update password via current password + username combo or via verification token. Optionally allows to invalidate
 * all issued JWT token for a given user. Valid input includes combos of `username`, `currentPassword` OR `resetToken`.
 *
 * @apiParam (Payload) {String} [username] - currently only email is supported
 * @apiParam (Payload) {String} [currentPassword] - current password
 * @apiParam (Payload) {String} [resetToken] - must be present if `username` or `currentPassword` is not
 * @apiParam (Payload) {String} newPassword - password will be changed to this
 * @apiParam (Payload) {Boolean} [invalidateTokens=false] - if set to `true` will invalidate issued tokens
 * @apiParam (Payload) {String} [remoteip] - will be used for rate limiting if supplied
 */
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
    promise = promise.tap(username => {
      return (new Attempts(this)).drop(username, remoteip);
    });
  }

  return promise.return({ success: true });
};

/**
 * Update password handler
 */
exports.updatePassword = setPassword;
