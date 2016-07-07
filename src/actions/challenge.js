const Promise = require('bluebird');
const emailChallenge = require('../utils/send-email.js');
const isActive = require('../utils/isActive');
const { User } = require('../model/usermodel');
const { ModelError, 
  ERR_ACCOUNT_NOT_ACTIVATED, 
  ERR_USERNAME_ALREADY_ACTIVE } = require('../model/modelError');

module.exports = function sendChallenge(message) {
  const { username } = message;

  // TODO: record all attemps
  // TODO: add metadata processing on successful email challenge

  return Promise
    .bind(this, username)
    .then(User.getOne)
    .tap(isActive)
    .throw(new ModelError(ERR_USERNAME_ALREADY_ACTIVE, username))
    .catchReturn({ code: ERR_ACCOUNT_NOT_ACTIVATED }, username)
    .then(emailChallenge.send);
};
