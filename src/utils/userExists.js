const Errors = require('common-errors');
const redisKey = require('../utils/key.js');
const { USERS_DATA, USERS_ALIAS_TO_LOGIN } = require('../constants.js');

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
        throw new Errors.HttpStatusError(404, `"${username}" does not exists`);
      }

      return username;
    });
};
