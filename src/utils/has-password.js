const Errors = require('common-errors');
const is = require('is');
const Promise = require('bluebird');
const { USERS_PASSWORD_FIELD } = require('../constants');

function hasPassword(data) {
  if (is.undefined(data[USERS_PASSWORD_FIELD]) === true) {
    return Promise.reject(new Errors.HttpStatusError(400, 'Account hasn\'t password'));
  }

  return Promise.resolve(data);
}

module.exports = hasPassword;
