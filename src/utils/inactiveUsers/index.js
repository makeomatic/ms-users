const {
  USERS_INACTIVATED,
} = require('../../constants');

/**
 * NOTE: Contents of this file will be removed when `DeleteInactiveUsers` feature merged.
 * To avoid `dlock` based locks, index cleanup and inactive user remove process will be merged into one LUA script.
 */

/**
 * Cleans Inactive user index from User IDs that not activated in some period
 * @returns {Promise<void>}
 */
async function cleanInactiveUsersIndex() {
  const { redis } = this;
  const { deleteInactiveAccounts } = this.config;
  const expire = Date.now() - (deleteInactiveAccounts * 1000);
  await redis.zremrangebyscore(USERS_INACTIVATED, '-inf', expire);
}

module.exports = {
  cleanInactiveUsersIndex,
};
