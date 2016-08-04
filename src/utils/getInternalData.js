const Errors = require('common-errors');
const redisKey = require('../utils/key.js');
const handlePipeline = require('../utils/pipelineError.js');
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
    .then(handlePipeline)
    .spread((aliasToUsername, exists, data) => {
      if (aliasToUsername) {
        return getInternalData.call(this, aliasToUsername);
      }

      if (!exists) {
        throw new Errors.HttpStatusError(404, `"${username}" does not exists`);
      }

      return { ...data, username };
    });
};
