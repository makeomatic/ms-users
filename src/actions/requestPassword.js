const Promise = require('bluebird');
const emailValidation = require('../utils/send-email.js');
const Users = require('../db/adapter');

module.exports = function requestPassword(opts) {
  const { username, generateNewPassword } = opts;
  const action = generateNewPassword ? 'password' : 'reset';

  // TODO: make use of remoteip in security logs?
  // var remoteip = opts.remoteip;

  return Promise
    .bind(this, username)
    .then(Users.getUser)
    .tap(Users.isActive)
    .tap(Users.isBanned)
    .then(() => emailValidation.send.call(this, username, action))
    .return({ success: true });
};
