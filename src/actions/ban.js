const Promise = require('bluebird');
const redisKey = require('../utils/key.js');
const userExists = require('../utils/userExists.js');
const { USERS_DATA, USERS_METADATA, USERS_BANNED_FLAG, USERS_TOKENS } = require('../constants.js');
const stringify = JSON.stringify.bind(JSON);

function lockUser(username) {
  const { redis, config } = this;
  const { jwt: { defaultAudience } } = config;

  return redis
    .pipeline()
    .hset(redisKey(username, USERS_DATA), USERS_BANNED_FLAG, 'true')
    // set .banned on metadata for filtering & sorting users by that field
    .hset(redisKey(username, USERS_METADATA, defaultAudience), 'banned', stringify(true))
    .del(redisKey(username, USERS_TOKENS))
    .exec();
}

function unlockUser(username) {
  const { redis, config } = this;
  const { jwt: { defaultAudience } } = config;

  return redis
    .pipeline()
    .hdel(redisKey(username, USERS_DATA), USERS_BANNED_FLAG)
    // remove .banned on metadata for filtering & sorting users by that field
    .hdel(redisKey(username, USERS_METADATA, defaultAudience), 'banned')
    .exec();
}

/**
 * Bans/unbans existing user
 * @param  {Object} opts
 * @return {Promise}
 */
module.exports = function banUser(opts) {
  const { username, ban } = opts;

  return Promise
    .bind(this, username)
    .tap(userExists)
    .then(ban ? lockUser : unlockUser);
};
