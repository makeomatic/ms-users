const {
  USERS_INACTIVATED,
} = require('../../constants');

/**
 * Add user id to inacive users list
 * @param {ioredis} redis
 * @param {userId} userId
 */
function addToInactiveUsers(redis, userId) {
  const created = Date.now();
  redis.zadd(USERS_INACTIVATED, created, userId);
}

/**
 * Remove user id from inactive users list
 * @param {ioredis} redis
 * @param {userId} userId
 */
function removeFromInactiveUsers(redis, userId) {
  redis.zrem(USERS_INACTIVATED, userId);
}

module.exports = {
  addToInactiveUsers,
  removeFromInactiveUsers,
};
