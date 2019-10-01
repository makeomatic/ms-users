const SlidingWindow = require('../sliding-window/limiter');
const redisKey = require('../key');
const assertStringNotEmpty = require('../asserts/string-not-empty');


class LoginUserIpRateLimiter {
  constructor(redis, interval, limit) {
    this.limiter = new SlidingWindow(redis, interval, limit);
  }

  static makeRedisKey(user, ip) {
    assertStringNotEmpty(user, '`user` is invalid');
    assertStringNotEmpty(ip, '`ip` is invalid');
    return redisKey(user, 'ip', ip);
  }

  reserve(user, ip) {
    const { limiter } = this;
    const key = LoginUserIpRateLimiter.makeRedisKey(user, ip);
    return limiter.reserve(key);
  }

  check(user, ip) {
    const { limiter } = this;
    const key = LoginUserIpRateLimiter.makeRedisKey(user, ip);
    return limiter.check(key);
  }

  cancel(user, ip, token) {
    const { limiter } = this;
    const key = LoginUserIpRateLimiter.makeRedisKey(user, ip);
    return limiter.cancel(key, token);
  }
}

module.exports = LoginUserIpRateLimiter;
