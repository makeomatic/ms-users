const Promise = require('bluebird');
const Errors = require('common-errors');
const { USERS_ACTIVE_FLAG } = require('../constants.js');

module.exports = function isBanned(data) {
  if (String(data[USERS_ACTIVE_FLAG]) !== 'true') {
    return Promise.reject(new Errors.HttpStatusError(412, 'Account hasn\'t been activated'));
  }

  return Promise.resolve(data);
};
