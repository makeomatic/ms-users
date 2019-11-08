const Promise = require('bluebird');
const getInternalData = require('../../userData/get-internal-data');

const {
  USERS_ALIAS_TO_ID,
  USERS_SSO_TO_ID,
  USERS_USERNAME_TO_ID,
  USERS_INDEX,
  USERS_PUBLIC_INDEX,
  USERS_DATA,
  USERS_TOKENS,
} = require('../../../constants');

class User {
  constructor(redis) {
    this.redis = redis;
  }

  static getUserDataKey(userId) {
    return `${userId}!${USERS_DATA}`;
  }

  flushCaches() {
    const now = Date.now();
    return Promise.all([
      this.redis.fsortBust(USERS_INDEX, now),
      this.redis.fsortBust(USERS_PUBLIC_INDEX, now),
    ]);
  }

  getData(userId) {
    return getInternalData.call({ redis: this.redis }, userId);
  }

  delete({ id, username, alias, ssoIds }, redis = this.redis) {
    const scriptKeys = [
      USERS_ALIAS_TO_ID, USERS_USERNAME_TO_ID, USERS_SSO_TO_ID,
      USERS_PUBLIC_INDEX, USERS_INDEX, USERS_TOKENS,
      User.getUserDataKey(id),
    ];
    const luaScript = `
      ${alias === undefined ? '' : `redis.call("HDEL", KEYS[1], '${alias}', '${alias.toLowerCase()}')`}
      redis.call("HDEL", KEYS[2], '${username}')
      ${ssoIds.length > 0 ? `redis.call("HDEL", KEYS[3], ${ssoIds.map((uid) => `'${uid}'`).join(',')})` : ''}
      redis.call("SREM", KEYS[4], '${id}')
      redis.call("SREM", KEYS[5], '${id}')
      redis.call("HDEL", KEYS[6], '${id}')
      redis.call("DEL", KEYS[7])
    `;
    return redis.eval(luaScript, scriptKeys.length, ...scriptKeys);
  }
}

module.exports = User;
