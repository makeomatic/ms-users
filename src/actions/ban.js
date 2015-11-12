const Errors = require('common-errors');
const redisKey = require('../utils/key.js');

/**
 * Bans/unbans existing user
 * @param  {Object} opts
 * @return {Promise}
 */
module.exports = function banUser(opts) {
  const { _redis: redis } = this;
  const { username, ban } = opts;

  const userKey = redisKey(username, 'data');

  return redis.hexists(userKey, 'password')
    .then(function exists(userExists) {
      if (!userExists) {
        throw new Errors.HttpStatusError(404, 'user does not exist');
      }

      return ban ? redis.hset(userKey, 'ban', 'true') : redis.hdel(userKey, 'ban');
    });
};
