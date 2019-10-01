const SlidingWindow = require('../sliding-window/limiter');
const assertStringNotEmpty = require('../asserts/string-not-empty');
const redisKey = require('../key');

class LoginGlobalIpRateLimiter {
  constructor(redis, interval, limit) {
    this.limiter = new SlidingWindow(redis, interval, limit);
  }

  static makeRedisKey(ip) {
    assertStringNotEmpty(ip, '`ip` is invalid');
    return redisKey('gl!ip!ctr', ip);
  }

  reserve(ip) {
    const { limiter } = this;
    const key = LoginGlobalIpRateLimiter.makeRedisKey(ip);
    return limiter.reserve(key);
  }

  check(ip) {
    const { limiter } = this;
    const key = LoginGlobalIpRateLimiter.makeRedisKey(ip);
    return limiter.check(key);
  }

  cancel(ip, token) {
    const { limiter } = this;
    const key = LoginGlobalIpRateLimiter.makeRedisKey(ip);
    return limiter.cancel(key, token);
  }
}

module.exports = LoginGlobalIpRateLimiter;
