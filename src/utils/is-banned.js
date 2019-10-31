const { USERS_BANNED_FLAG, ErrorAccountLocked } = require('../constants');

module.exports = function isBanned(data) {
  if (String(data[USERS_BANNED_FLAG]) === 'true') {
    throw ErrorAccountLocked;
  }

  return data;
};
