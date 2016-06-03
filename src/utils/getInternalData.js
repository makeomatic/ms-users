const Errors = require('common-errors');
const redisKey = require('../utils/key.js');
const { USERS_DATA, USERS_ALIAS_TO_LOGIN } = require('../constants.js');

module.exports = function getInternalData(username) {
  const { redis } = this;
  const userKey = redisKey(username, USERS_DATA);
  
  return redis
    .pipeline()
    .hget(USERS_ALIAS_TO_LOGIN, username)
    .exists(userKey)
    .hgetallBuffer(userKey)
    .exec()
    .spread((aliasToUsername, exists, data) => {
      if (aliasToUsername[1]) {
        return getInternalData.call(this, aliasToUsername[1]);
      }

      if (!exists[1]) {
        throw new Errors.HttpStatusError(404, `"${username}" does not exists`);
      }

      return { ...data[1], username };
    });
};
