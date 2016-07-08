const Promise = require('bluebird');
const { ModelError, ERR_ACCOUNT_IS_LOCKED } = require('../model/modelError');
const { USERS_BANNED_FLAG } = require('../constants.js');

module.exports = function isBanned(data) {
  if (String(data[USERS_BANNED_FLAG]) === 'true') {
    return Promise.reject(new ModelError(ERR_ACCOUNT_IS_LOCKED));
  }
  return Promise.resolve(data);
};
