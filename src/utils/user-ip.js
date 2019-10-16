const assertStringNotEmpty = require('./asserts/string-not-empty');
const redisKey = require('./key');

/**
 * Class handles User2Ip Binding Index
 */
class UserIp {
  /**
   * @param {ioredis} redis
   */
  constructor(redis) {
    this.redis = redis;
  }

  /* User login IP tracking */
  static USER_IPS = 'user-ips';

  /**
   * @param user
   * @returns {String}
   */
  static makeRedisKey(user) {
    assertStringNotEmpty(user, '`user` is invalid');
    return redisKey(user, UserIp.USER_IPS);
  }

  /**
   * Assigns IP to User
   * @param {*} user - UserId
   * @param {string} ip
   * @returns {Promise<*>}
   */
  addIp(user, ip) {
    const userIPsKey = UserIp.makeRedisKey(user);
    return this.redis.sadd(userIPsKey, ip);
  }

  /**
   * Gets IPs assigned to User
   * @param user
   * @returns {Promise<*>}
   */
  async getIps(user) {
    const userIPsKey = UserIp.makeRedisKey(user);
    return this.redis.smembers(userIPsKey);
  }

  /**
   * Remove all IP assigned to User
   * @param user
   * @returns {Promise<*>}
   */
  async cleanIps(user) {
    const userIPsKey = UserIp.makeRedisKey(user);
    return this.redis.del(userIPsKey);
  }
}

module.exports = UserIp;
