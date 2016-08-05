const { HttpStatusError } = require('common-errors');
const { USERS_DATA, USERS_ALIAS_TO_LOGIN } = require('../constants.js');
const handlePipeline = require('../utils/pipelineError.js');
const redisKey = require('../utils/key.js');

module.exports = function userExists(username) {
  return this
    .redis
    .pipeline()
    .hget(USERS_ALIAS_TO_LOGIN, username)
    .exists(redisKey(username, USERS_DATA))
    .exec()
    .then(handlePipeline)
    .spread((alias, exists) => {
      if (alias) {
        return alias;
      }

      if (!exists) {
        throw new HttpStatusError(404, `"${username}" does not exists`);
      }

      return username;
    });
};
