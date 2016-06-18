const Promise = require('bluebird');
const { ModelError, ERR_ACCOUNT_NOT_ACTIVATED } = require('../model/modelError');
const { USERS_ACTIVE_FLAG } = require('../constants.js');

module.exports = function isBanned(data) {
  if (String(data[USERS_ACTIVE_FLAG]) !== 'true') {
    return Promise.reject(new ModelError(ERR_ACCOUNT_NOT_ACTIVATED));
  }

  return Promise.resolve(data);
};
