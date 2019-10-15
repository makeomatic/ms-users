const uuid = require('uuid/v4');
const assert = require('assert');

const SlidingWindowRedisBackend = require('../sliding-window/redis/limiter');
const redisKey = require('../key');
const assertStringNotEmpty = require('../asserts/string-not-empty');

const UserIpManager = require('../user-ip-manager');

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
    assert.ok(redis, '`redis` required');
    assert.ok(config, '`config` required');

    this.redis = redis;
    this.config = config;
    this.token = uuid();
    this.ipManager = new UserIpManager(redis);

    const { ipLimitEnabled, userIpLimitEnabled } = config;

    if (ipLimitEnabled) {
      this.ipLimiter = new SlidingWindowRedisBackend(redis, {
        interval: config.ipLimitInterval,
        limit: config.ipLimitAttemptsCount,
        blockInterval: config.ipBlockInterval,
      });
    }
    if (userIpLimitEnabled) {
      this.loginIpLimiter = new SlidingWindowRedisBackend(redis, {
        interval: config.userIpLimitInterval,
        limit: config.userIpLimitAttemptsCount,
        blockInterval: config.userIpBlockInterval,
      });
    }
  }

  /* Key for IP tokens  */
  static makeIpKey(ip) {
    assertStringNotEmpty(ip, '`ip` is invalid');
    return redisKey('gl!ip!ctr', ip);
  }

  /* Key for UserID-IP tokens */
  static makeUserKey(user, ip) {
    assertStringNotEmpty(user, '`user` is invalid');
    assertStringNotEmpty(ip, '`ip` is invalid');
    return redisKey(user, 'ip', ip);
  }

  /**
   * Reserve attempt token for IP
   * @param {string} ip
   * @returns {Promise<{usage: number, limit: number, token: null}|{usage: *, limit: *, token: *}>}
   */
  async reserveForIp(ip) {
    const key = UserLoginRateLimiter.makeIpKey(ip);
    return this.ipLimiter.reserve(key, this.token);
  }

  /**
   * Reserve attempt token for UserID and IP pair
   * @param {string|int} userId
   * @param {string} ip
   * @returns {Promise<{usage: number, limit: number, token: null}|{usage: *, limit: *, token: *}>}
   */
  async reserveForUserIp(user, ip) {
    const key = UserLoginRateLimiter.makeUserKey(user, ip);
    const result = await this.loginIpLimiter.reserve(key, this.token);
    await this.ipManager.addIp(user, ip);
    return result;
  }

  /**
   * Get Sliding window usage information for IP
   * @param {ip} ip
   * @returns {Promise<{usage: *, limit: *, reset: *}>}
   */
  async checkForIp(ip) {
    const key = UserLoginRateLimiter.makeIpKey(ip);
    return this.ipLimiter.check(key);
  }

  /**
   * Get Sliding window usage information for UserID and IP pair
   * @param user
   * @param ip
   * @returns {Promise<{usage: *, limit: *, reset: *}>}
   */
  async checkForUserIp(user, ip) {
    const key = UserLoginRateLimiter.makeUserKey(user, ip);
    return this.loginIpLimiter.check(key);
  }

  /**
   * Remove all attempts tokens for provided ip
   * @param {string} ip
   * @returns {Promise<void>}
   */
  async cleanupForIp(ip) {
    const key = UserLoginRateLimiter.makeIpKey(ip);
    return this.ipLimiter.cleanup(key);
  }

  /**
   * Remove all attempt tokens fro provided UserID and IP pair
   * @param user
   * @param ip
   * @returns {Promise<void>}
   */
  async cleanupForUserIp(user, ip) {
    const ipKeysToClean = [];
    const key = UserLoginRateLimiter.makeUserKey(user, ip);
    const userIPs = await this.ipManager.getIps(user);

    for (const userIP of userIPs) {
      ipKeysToClean.push(UserLoginRateLimiter.makeIpKey(userIP));
    }

    await this.ipManager.cleanIps(user);
    return this.loginIpLimiter.cleanup(key, ...ipKeysToClean);
  }

  isIpRateLimiterEnabled() {
    return this.config.ipLimitEnabled;
  }

  isUserIpRateLimiterEnabled() {
    return this.config.userIpLimitEnabled;
  }
}

module.exports = UserLoginRateLimiter;
