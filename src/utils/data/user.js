const redisKey = require('../key.js');
const {
  USERS_DATA,
  USERS_ACTIVE_FLAG,
  USERS_BANNED_FLAG,
  USERS_MFA_FLAG,
  USERS_ALIAS_FIELD,
  USERS_ALIAS_TO_ID,
  USERS_SSO_TO_ID,
  USERS_USERNAME_TO_ID,
  USERS_PASSWORD_FIELD,
} = require('../../constants');

/**
 * User data abstraction
 */
class UserData {
  constructor(redis) {
    this.redis = redis;
  }

  static register(userId, pipeline, basicInfo, activate, deleteInactiveAccounts) {
    const userDataKey = redisKey(userId, USERS_DATA);
    pipeline.hmset(userDataKey, basicInfo);
    if (activate === false && deleteInactiveAccounts >= 0) {
      pipeline.expire(userDataKey, deleteInactiveAccounts);
    }
  }

  static setMFA(userId, pipeline, secret) {
    return pipeline.hset(redisKey(userId, USERS_DATA), USERS_MFA_FLAG, secret);
  }

  static delMFA(userId, pipeline) {
    return pipeline.hdel(redisKey(userId, USERS_DATA), USERS_MFA_FLAG);
  }

  static deleteUserData(userId, pipeline) {
    pipeline.del(redisKey(userId, USERS_DATA));
  }

  lock(userId) {
    return this.redis.pipeline().hset(redisKey(userId, USERS_DATA), USERS_BANNED_FLAG, 'true');
  }

  activate(userId) {
    const userKey = redisKey(userId, USERS_DATA);
    return this.redis.pipeline()
      .hget(userKey, USERS_ACTIVE_FLAG)
      .hset(userKey, USERS_ACTIVE_FLAG, 'true')
      // WARNING: `persist` is very important, otherwise we will lose user's information in 30 days
      // set to active & persist
      .persist(userKey);
  }

  unLock(userId) {
    return this.redis.pipeline().hdel(redisKey(userId, USERS_DATA), USERS_BANNED_FLAG);
  }

  refresh(userId, provider, internals) {
    return this.redis.hset(redisKey(userId, USERS_DATA), provider, JSON.stringify(internals)).return(true);
  }

  getMFA(userId) {
    return this.redis.hget(redisKey(userId, USERS_DATA), USERS_MFA_FLAG);
  }

  setAlias(userId, alias) {
    return this.redis.pipeline().hset(redisKey(userId, USERS_DATA), USERS_ALIAS_FIELD, alias);
  }

  delProvider(userId, provider) {
    return this.redis.pipeline().hdel(redisKey(userId, USERS_DATA), provider);
  }

  attachProvider(userId, provider, internals) {
    // inject private info to user internal data
    return this.redis.pipeline().hset(redisKey(userId, USERS_DATA), provider, JSON.stringify(internals));
  }

  setPassword(userId, password) {
    return this.redis.hset(redisKey(userId, USERS_DATA), USERS_PASSWORD_FIELD, password);
  }

  getBanned(userId) {
    return this.redis.hget(redisKey(userId, USERS_DATA), USERS_BANNED_FLAG);
  }

  registerInOrganization(userId, organizationData) {
    return this.redis.pipeline().hmset(redisKey(userId, USERS_DATA), organizationData);
  }

  resolveUserIdBuffer(id, fetchData) {
    const indexPlaceholder = 'userId';
    const userDataIndex = redisKey(indexPlaceholder, USERS_DATA);
    const numberOfKeys = 4;
    return this.redis
      .resolveUserIdBuffer(
        numberOfKeys,
        userDataIndex,
        USERS_USERNAME_TO_ID,
        USERS_ALIAS_TO_ID,
        USERS_SSO_TO_ID,
        id,
        fetchData === true ? 1 : 0,
        indexPlaceholder
      );
  }
}

module.exports = UserData;
