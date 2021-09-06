const Promise = require('bluebird');
const DetailedHttpStatusError = require('./detailed-error');
const { USERS_ACTIVE_FLAG, USERS_USERNAME_FIELD } = require('../constants');

module.exports = function isActive(data, sync) {
  if (String(data[USERS_ACTIVE_FLAG]) !== 'true') {
    return sync ? false : Promise.reject(DetailedHttpStatusError(412, 'Account hasn\'t been activated', { username: data[USERS_USERNAME_FIELD] }));
  }

  return sync ? true : Promise.resolve(data);
};
