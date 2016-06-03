'use strict';

const Promise = require('bluebird');
const Errors = require('common-errors');
const emailChallenge = require('../utils/send-email.js');
const Users = require('../db/adapter');

module.exports = function sendChallenge(message) {
  const { username } = message;

  // TODO: record all attemps
  // TODO: add metadata processing on successful email challenge

  return Promise.bind(this, username).then(Users.getUser).tap(Users.isActive).throw(new Errors.HttpStatusError(417, `${ username } is already active`)).catchReturn({ statusCode: 412 }, username).then(emailChallenge.send);
};

//# sourceMappingURL=challenge-compiled.js.map