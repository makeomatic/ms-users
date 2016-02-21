const Promise = require('bluebird');
const Errors = require('common-errors');
const getInternalData = require('../utils/getInternalData.js');
const isActive = require('../utils/isActive.js');
const isBanned = require('../utils/isBanned.js');
const key = require('../utils/key.js');
const { USERS_DATA, USERS_METADATA, USERS_PUBLIC_INDEX, USERS_ALIAS_TO_LOGIN, USERS_ALIAS_FIELD } = require('../constants.js');

module.exports = function assignAlias(opts) {
  const { redis, config: { jwt: { defaultAudience } } } = this;
  const { username, alias } = opts;

  return Promise
    .bind(this, username)
    .then(getInternalData)
    .tap(isActive)
    .tap(isBanned)
    .then(data => {
      if (data[USERS_ALIAS_FIELD]) {
        throw new Errors.HttpStatusError(417, 'alias is already assigned');
      }

      return redis.hsetnx(USERS_ALIAS_TO_LOGIN, alias, username);
    })
    .then(assigned => {
      if (assigned === 0) {
        throw new Errors.HttpStatusError(409, 'alias was already taken');
      }

      return redis
        .pipeline()
        .sadd(USERS_PUBLIC_INDEX, username)
        .hset(key(username, USERS_DATA), USERS_ALIAS_FIELD, alias)
        .hset(key(username, USERS_METADATA, defaultAudience), USERS_ALIAS_FIELD, alias)
        .exec();
    });
};
