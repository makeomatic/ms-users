const assert = require('assert');
const { isRedis } = require('../../asserts/redis');
const isValidId = require('../../asserts/id');
const isInteger = require('../../asserts/integer');

/**
 * Class Handling Inactive Users index using Redis backend
 */
class InactiveUser {
  static REDIS_KEY = 'users-inactivated';

  /**
   * @param {ioredis|Pipeline}redis
   */
  constructor(redis) {
    assert(isRedis(redis), 'must be a valid redis instance');
    this.redis = redis;
  }

  /**
   * Get list of Ids having score < Now()-interval
   * @param {Number}interval - seconds
   * @returns {Promise<string[]>|Pipeline}
   */
  get(interval) {
    assert(isInteger(interval), 'must be valid interval');
    const expire = Date.now() - (interval * 1000);
    return this.redis.zrangebyscore(InactiveUser.REDIS_KEY, '-inf', expire);
  }

  /**
   * @param {String|Number}userId
   * @param {Number}createTime - timestamp
   * @param {ioredis|Pipeline}[redis]
   * @returns {Promise<*>|Pipeline}
   */
  add(userId, createTime, redis = this.redis) {
    assert(isValidId(userId), 'must be valid user id');
    assert(isInteger(createTime), 'must be valid timestamp');
    return redis.zadd(InactiveUser.REDIS_KEY, createTime, userId);
  }

  /**
   * Deletes passed ID from index
   * @param {String|Number}userId
   * @param {ioredis|Pipeline}[redis]
   * @returns {Promise<*>|Pipeline}
   */
  delete(userId, redis = this.redis) {
    assert(isValidId(userId), 'must be valid user id');
    return redis.zrem(InactiveUser.REDIS_KEY, userId);
  }
}

module.exports = InactiveUser;
