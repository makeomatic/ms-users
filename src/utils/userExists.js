const { HttpStatusError } = require('common-errors');
const { USERS_DATA, USERS_ALIAS_TO_LOGIN } = require('../constants.js');
const redisKey = require('../utils/key.js');

module.exports = function userExists(username) {
  return this
    .redis
    .pipeline()
    .hget(USERS_ALIAS_TO_LOGIN, username)
    .exists(redisKey(username, USERS_DATA))
    .exec()
    .spread((alias, exists) => {
      if (alias[1]) {
        return alias[1];
      }

      if (!exists[1]) {
        throw new HttpStatusError(404, `"${username}" does not exists`);
      }

      return username;
    });
};
