const uuid = require('uuid/v4');
const { helpers: errorHelpers } = require('common-errors');
const assertStringNotEmpty = require('../asserts/string-not-empty');
const SlidingWindowRedisBackend = require('../sliding-window/redis/limiter');
const redisKey = require('../key');

/**
 * Class controls rate limits on User Login attempts
 */
class UserLoginRateLimiter {
  /**
   * Create Login Action Rate Limiter
   * @param {ioredis} redis
   * @param {object} config
   */
  constructor(redis, config) {
    this.redis = redis;
    this.config = config;
    this.token = uuid();

    this.ipLimiter = new SlidingWindowRedisBackend(redis, config.limitIp);
    this.userIpLimiter = new SlidingWindowRedisBackend(redis, config.limitUserIp);
  }

  static RateLimitError = errorHelpers.generateClass('RateLimitError', { args: ['ip', 'reset', 'limit'] });

  /* Key for IP tokens  */
  static makeRedisIpKey(ip) {
    assertStringNotEmpty(ip, '`ip` is invalid');
    return redisKey('gl!ip!ctr', ip);
  }

  /* Key for UserID-IP tokens */
  static makeRedisUserIpKey(user, ip) {
    assertStringNotEmpty(user, '`user` is invalid');
    assertStringNotEmpty(ip, '`ip` is invalid');
    return redisKey(user, 'ip', ip);
  }

  static handleError(ip) {
    return (error) => {
      if (error instanceof SlidingWindowRedisBackend.RateLimitError) {
        throw UserLoginRateLimiter.RateLimitError(ip, error.reset, error.limit);
      }
      throw error;
    };
  }

  /**
   * Reserve attempt token for IP
   * @param {string} ip
   * @returns {Promise<{usage: number, limit: number, token: null}|{usage: *, limit: *, token: *}>}
   */
  async reserveForIp(ip) {
    const key = UserLoginRateLimiter.makeRedisIpKey(ip);
    return this.ipLimiter
      .reserve(key, this.token)
      .catch(UserLoginRateLimiter.handleError(ip));
  }

  /**
   * Reserve attempt token for UserID and IP pair
   * @param {string|int} userId
   * @param {string} ip
   * @returns {Promise<{usage: number, limit: number, token: null}|{usage: *, limit: *, token: *}>}
   */
  async reserveForUserIp(user, ip) {
    const key = UserLoginRateLimiter.makeRedisUserIpKey(user, ip);
    return this.userIpLimiter
      .reserve(key, this.token)
      .catch(UserLoginRateLimiter.handleError(ip));
  }

  /**
   * Remove all attempt tokens fro provided UserID and IP pair
   * @param user
   * @param ip
   * @returns {Promise<void>}
   */
  async cleanupForUserIp(user, ip) {
    return this.userIpLimiter.cleanup(
      UserLoginRateLimiter.makeRedisUserIpKey(user, ip),
      UserLoginRateLimiter.makeRedisIpKey(ip)
    );
  }

  isEnabled() {
    return this.config.enabled;
  }
}

module.exports = UserLoginRateLimiter;
