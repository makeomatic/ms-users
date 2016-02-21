const Errors = require('common-errors');
const redisKey = require('../utils/key.js');
const { USERS_DATA } = require('../constants.js');

module.exports = function userExists(username) {
  return this
    .redis
    .exists(redisKey(username, USERS_DATA))
    .then(exists => {
      if (!exists) {
        throw new Errors.HttpStatusError(404, `"${username}" does not exists`);
      }

      return username;
    });
};
