
const {
  USERS_INACTIVATED,
} = require('../../constants');

/**
 * Clean all users, who did't pass activation
 * see scripts/deleteInactivated.lua
 * @param {ioredis} redis
 * @param {int} ttl - seconds
 */
async function deleteInactiveUsers(redis, ttl) {
  const expire = Date.now() - (ttl * 1000);
  return redis.deleteInactivatedUsers(1, USERS_INACTIVATED, expire);
}

module.exports = deleteInactiveUsers;
