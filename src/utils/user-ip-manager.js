const assert = require('assert');
const assertStringNotEmpty = require('./asserts/string-not-empty');
const redisKey = require('./key');

/**
 * Class handles User2Ip Binding Index
 */
class UserIpManger {
  /**
   * @param {ioredis} redis
   * @param {string} prefix - Key prefix
   */
  constructor(redis, prefix = '') {
    assert.ok(redis, 'invalid `redis` argument');
    this.prefix = prefix;
    this.redis = redis;
  }

  /* User login IP tracking */
  static USER_IPS = 'user-login-ips';

  /**
   * @param user
   * @returns {String}
   */
  makeUserIPsKey(user) {
    assertStringNotEmpty(user, '`user` is invalid');
    return redisKey(this.prefix, UserIpManger.USER_IPS, user);
  }

  /**
   * Assigns IP to User
   * @param {*} user - UserId
   * @param {string} ip
   * @returns {Promise<*>}
   */
  async addIp(user, ip) {
    const userIPsKey = this.makeUserIPsKey(user);
    return this.redis.sadd(userIPsKey, ip);
  }

  /**
   * Gets IPs assigned to User
   * @param user
   * @returns {Promise<*>}
   */
  async getIps(user) {
    const userIPsKey = this.makeUserIPsKey(user);
    return this.redis.smembers(userIPsKey);
  }

  /**
   * Remove all IP assigned to User
   * @param user
   * @returns {Promise<*>}
   */
  async cleanIps(user) {
    const userIPsKey = this.makeUserIPsKey(user);
    return this.redis.del(userIPsKey);
  }
}

module.exports = UserIpManger;
