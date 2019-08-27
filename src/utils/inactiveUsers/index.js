const Promise = require('bluebird');

const {
  USERS_INACTIVATED,
  USERS_ACTION_ACTIVATE,
  USERS_ACTION_REGISTER,
  USERS_ACTION_PASSWORD,
  USERS_ACTION_RESET,
  USERS_ACTION_ORGANIZATION_INVITE,
  USERS_ACTION_ORGANIZATION_REGISTER,
} = require('../../constants');
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
 * Deletes invites and action tokens for provided user list
 * @param userIds
 * @returns {Promise<[*]>}
 */
function cleanTokens(userIds) {
  const actions = [
    USERS_ACTION_ACTIVATE, USERS_ACTION_REGISTER,
    USERS_ACTION_PASSWORD, USERS_ACTION_RESET,
    USERS_ACTION_ORGANIZATION_INVITE, USERS_ACTION_ORGANIZATION_REGISTER,
  ];

  const work = userIds.reduce((prev, id) => {
    const delTokenActions = [];
    for (const action of actions) {
      delTokenActions.push(
        this.tokenManager.remove({ id, action })
      );
    }
    return [...prev, ...delTokenActions];
  }, []);

  return Promise.all(work);
}

/**
 * Deletes users that didn't pass activation
 * @param suppressError boolean throw or suppress error
 * @returns {Promise<[]>}
 */
async function cleanUsers(suppressError = true) {
  const { redis } = this;
  const { deleteInactiveAccounts } = this.config;
  let deletedUsers = [];

  try {
    deletedUsers = await deleteInactiveUsers(redis, deleteInactiveAccounts);
    await cleanTokens.call(this, deletedUsers);
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
