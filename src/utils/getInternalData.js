const Errors = require('common-errors');
const redisKey = require('../utils/key.js');
const { USERS_DATA } = require('../constants.js');

module.exports = function getInternalData(username) {
  const { redis } = this;
  const userKey = redisKey(username, USERS_DATA);

  return redis
    .pipeline()
    .exists(userKey)
    .hgetallBuffer(userKey)
    .exec()
    .spread((exists, data) => {
      if (!exists[1]) {
        throw new Errors.HttpStatusError(404, `"${username}" does not exists`);
      }

      return data[1];
    });
};
