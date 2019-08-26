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

/**
 * Deletes users that didn't pass activation
 * @param suppressError boolean throw or suppress error
 * @returns {Promise<number>}
 */
async function cleanUsers(suppressError = true) {
  const { redis } = this;
  const { deleteInactiveAccounts } = this.config;
  let deletedUsers = 0;

  try {
    deletedUsers = await deleteInactiveUsers(redis, deleteInactiveAccounts);
  } catch (e) {
    if (suppressError) {
      this.log.error({ error: e }, e.message);
    } else {
      throw e;
    }
  }

  return deletedUsers;
}

module.exports = {
  addToInactiveUsers,
  removeFromInactiveUsers,
  cleanUsers,
  defineCommand,
};
