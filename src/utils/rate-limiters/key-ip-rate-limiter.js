const { KeyRateLimiter, ErrorRateLimiterConfig } = require('./key-rate-limiter');

class KeyIpRateLimiter {
  constructor({ name, config, redis }) {
    const { limitIp, limitKeyIp } = config;

    if (!name || !limitIp || !limitKeyIp || !redis) {
      throw ErrorRateLimiterConfig;
    }

    this.limiterIp = new KeyRateLimiter({
      config: limitIp,
      name: `${name}-ip`,
      redis,
    });
    this.limiterKeyIp = new KeyRateLimiter({
      config: limitKeyIp,
      name: `${name}-key-ip`,
      redis,
    });
  }

  async check(key, ip) {
    const [statusIp, statusKeyIp] = await Promise.all([
      this.limiterIp.check(ip),
      this.limiterKeyIp.check(key, ip),
    ]);

    return {
      statusIp,
      statusKeyIp,
    };
  }

  async reserve(key, ip) {
    const results = await Promise.allSettled([
      this.limiterIp.reserve(ip),
      this.limiterKeyIp.reserve(key, ip),
    ]);

    const [tokenIp, tokenKeyIp] = results.map(({ reason, value }) => {
      if (reason) {
        throw reason;
      }

      return value;
    });

    return {
      tokenIp,
      tokenKeyIp,
    };
  }
}

KeyIpRateLimiter.RateLimitError = KeyRateLimiter.RateLimitError;

module.exports = {
  KeyIpRateLimiter,
};
