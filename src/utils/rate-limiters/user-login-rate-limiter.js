const uuid = require('uuid/v4');
const { helpers: errorHelpers } = require('common-errors');
const assertStringNotEmpty = require('../asserts/string-not-empty');
const UserIp = require('../user-ip');
const LoginAttempt = require('../login-attempt');
const SlidingWindowRedisBackend = require('../sliding-window/redis/limiter');
const redisKey = require('../key');

/**
 * Class controls rate limits on User Login attempts
 * */
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
    this.userIp = new UserIp(redis);

    this.ipLimiter = new SlidingWindowRedisBackend(redis, config.forIp);
    this.userIpLimiter = new SlidingWindowRedisBackend(redis, config.forUserIp);
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
   * Get Sliding window usage information for IP
   * @param {ip} ip
   * @returns {Promise<{usage: *, limit: *, reset: *}>}
   */
  async checkForIp(ip) {
    const key = UserLoginRateLimiter.makeRedisIpKey(ip);
    return this.ipLimiter.check(key);
  }

  /**
   * Get Sliding window usage information for UserID and IP pair
   * @param user
   * @param ip
   * @returns {Promise<{usage: *, limit: *, reset: *}>}
   */
  async checkForUserIp(user, ip) {
    const key = UserLoginRateLimiter.makeRedisUserIpKey(user, ip);
    return this.userIpLimiter.check(key);
  }

  /**
   * Remove all attempt tokens fro provided UserID and IP pair
   * @param user
   * @param ip
   * @returns {Promise<void>}
   */
  async cleanupForUserIp(user, ip) {
    const keysToClean = [UserLoginRateLimiter.makeRedisUserIpKey(user, ip)];
    const userIPs = await this.userIp.getIps(user);

    for (const userIP of userIPs) {
      keysToClean.push(UserLoginRateLimiter.makeRedisIpKey(userIP));
      keysToClean.push(UserLoginRateLimiter.makeRedisUserIpKey(user, userIP));
    }

    return this.userIpLimiter.cleanup(LoginAttempt.getRedisKey(user), ...keysToClean);
  }

  isEnabled() {
    return this.config.enabled;
  }
}

module.exports = UserLoginRateLimiter;
