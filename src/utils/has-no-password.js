const Errors = require('common-errors');
const is = require('is');
const Promise = require('bluebird');
const { USERS_PASSWORD_FIELD } = require('../constants');

function hasNotPassword(data) {
  if (is.undefined(data[USERS_PASSWORD_FIELD]) === false) {
    return Promise.reject(new Errors.HttpStatusError(400, 'Account has password'));
  }

  return Promise.resolve(data);
}

module.exports = hasNotPassword;
