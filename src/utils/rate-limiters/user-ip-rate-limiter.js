const uuid = require('uuid/v4');

const SlidingWindowRedisBackend = require('../sliding-window/redis/limiter');
const redisKey = require('../key');
const assertStringNotEmpty = require('../asserts/string-not-empty');

function makeIpKey(ip) {
  assertStringNotEmpty(ip, '`ip` is invalid');
  return redisKey('gl!ip!ctr', ip);
}

function makeUserKey(user, ip) {
  assertStringNotEmpty(user, '`user` is invalid');
  assertStringNotEmpty(ip, '`ip` is invalid');
  return redisKey(user, 'ip', ip);
}

class LoginUserIpRateLimiter {
  constructor(redis, ipRateLimiterConfig, userIpRateLimiterConfig) {
    this.ipLimiter = new SlidingWindowRedisBackend(redis, ipRateLimiterConfig);
    this.loginIpLimiter = new SlidingWindowRedisBackend(redis, userIpRateLimiterConfig);
    this.token = uuid();
  }

  async reserveForIp(ip) {
    const key = makeIpKey(ip);
    return this.ipLimiter.reserve(key, this.token);
  }

  async reserveForUserIp(user, ip) {
    const key = makeUserKey(user, ip);
    return this.loginIpLimiter.reserve(key, this.token);
  }

  async checkForIp(ip) {
    const key = makeIpKey(ip);
    return this.ipLimiter.check(key);
  }

  async checkForUserIp(user, ip) {
    const key = makeUserKey(user, ip);
    return this.loginIpLimiter.check(key);
  }

  async cleanupForIp(ip) {
    const key = makeIpKey(ip);
    return this.ipLimiter.cleanup(key);
  }

  async cleanupForUserIp(user, ip) {
    const key = makeUserKey(user, ip);
    return this.loginIpLimiter.cleanup(key);
  }
}

module.exports = LoginUserIpRateLimiter;
