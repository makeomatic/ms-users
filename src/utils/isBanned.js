const Promise = require('bluebird');
const Errors = require('common-errors');
const { USERS_BANNED_FLAG } = require('../constants.js');

module.exports = function isBanned(data) {
  if (String(data[USERS_BANNED_FLAG]) === 'true') {
    return Promise.reject(new Errors.HttpStatusError(423, 'Account has been locked'));
  }

  return Promise.resolve(data);
};
