const Promise = require('bluebird');
const mapValues = require('lodash/mapValues');
const stringify = JSON.stringify.bind(JSON);

const redisKey = require('../utils/key.js');
const userExists = require('../utils/userExists.js');
const {
  USERS_DATA, USERS_METADATA,
  USERS_BANNED_FLAG, USERS_TOKENS, USERS_BANNED_DATA,
} = require('../constants.js');

function lockUser({ username, reason, whom, remoteip }) {
  const { redis, config } = this;
  const { jwt: { defaultAudience } } = config;
  const data = {
    banned: true,
    [USERS_BANNED_DATA]: {
      reason: reason || '',
      whom: whom || '',
      remoteip: remoteip || '',
    },
  };

  return redis
    .pipeline()
    .hset(redisKey(username, USERS_DATA), USERS_BANNED_FLAG, 'true')
    // set .banned on metadata for filtering & sorting users by that field
    .hmset(redisKey(username, USERS_METADATA, defaultAudience), mapValues(data, stringify))
    .del(redisKey(username, USERS_TOKENS))
    .exec();
}

function unlockUser({ username }) {
  const { redis, config } = this;
  const { jwt: { defaultAudience } } = config;

  return redis
    .pipeline()
    .hdel(redisKey(username, USERS_DATA), USERS_BANNED_FLAG)
    // remove .banned on metadata for filtering & sorting users by that field
    .hdel(redisKey(username, USERS_METADATA, defaultAudience), 'banned', USERS_BANNED_DATA)
    .exec();
}

/**
 * Bans/unbans existing user
 * @param  {Object} opts
 * @return {Promise}
 */
module.exports = function banUser(opts) {
  return Promise
    .bind(this, opts.username)
    .then(userExists)
    .then(username => ({ ...opts, username }))
    .then(opts.ban ? lockUser : unlockUser);
};
