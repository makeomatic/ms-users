const { USERS_INACTIVATED } = require('../../constants');

const deleteInactiveUsers = require('./delete');
const defineCommand = require('./defineCommand');

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

async function cleanUsers() {
  const { redis } = this;
  const { deleteInactiveAccounts } = this.config;
  let deletedUsers = 0;

  try {
    deletedUsers = await deleteInactiveUsers(redis, deleteInactiveAccounts);
  } catch (e) {
    this.log.error(e);
  }

  return deletedUsers;
}

module.exports = {
  addToInactiveUsers,
  removeFromInactiveUsers,
  cleanUsers,
  defineCommand,
};
