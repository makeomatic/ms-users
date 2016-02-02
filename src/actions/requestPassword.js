const Promise = require('bluebird');
const emailValidation = require('../utils/send-email.js');
const getInternalData = require('../utils/getInternalData.js');
const isActive = require('../utils/isActive.js');
const isBanned = require('../utils/isBanned.js');

module.exports = function requestPassword(opts) {
  const { username, generateNewPassword } = opts;
  const action = generateNewPassword ? 'password' : 'reset';

  // TODO: make use of remoteip in security logs?
  // var remoteip = opts.remoteip;

  return Promise
    .bind(this, username)
    .then(getInternalData)
    .tap(isActive)
    .tap(isBanned)
    .then(() => emailValidation.send.call(this, username, action))
    .return({ success: true });
};
