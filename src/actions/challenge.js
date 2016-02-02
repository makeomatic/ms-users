const Promise = require('bluebird');
const Errors = require('common-errors');
const emailChallenge = require('../utils/send-email.js');
const getInternalData = require('../utils/getInternalData.js');
const isActive = require('../utils/isActive.js');

module.exports = function sendChallenge(message) {
  const { username } = message;

  // TODO: record all attemps
  // TODO: add metadata processing on successful email challenge

  return Promise
    .bind(this, username)
    .then(getInternalData)
    .tap(isActive)
    .throw(new Errors.HttpStatusError(417, `${username} is already active`))
    .catchReturn({ statusCode: 412 }, username)
    .then(emailChallenge.send);
};
