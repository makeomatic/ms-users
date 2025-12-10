const { v4 } = require('uuid');
const { helpers: errorHelpers } = require('common-errors');
const SlidingWindowRedisBackend = require('../sliding-window-limiter/redis');
const makeRedisKey = require('../key');

const ErrorRateLimiterConfig = new Error('Invalid rate limiter config');
const ErrorRedisKeyParts = new Error('Invalid redis key parts');

class KeyRateLimiter {
  constructor({ name, config, redis }) {
    if (!name || !config || !redis) {
      throw ErrorRateLimiterConfig;
    }

    this.name = name;
    this.limiter = new SlidingWindowRedisBackend(redis, config);
  }

  makeRedisKey(parts) {
    if (!parts.length) {
      throw ErrorRedisKeyParts;
    }

    return makeRedisKey('rate-limit', this.name, ...parts);
  }

  async check(...parts) {
    const redisKey = this.makeRedisKey(parts);
    const status = await this.limiter.check(redisKey);
    const { usage, limit, reset } = status;

    if (usage >= limit) {
      throw KeyRateLimiter.RateLimitError(redisKey, reset, limit);
    }

    return status;
  }

  async reserve(...parts) {
    const redisKey = this.makeRedisKey(parts);
    let token;

    try {
      token = await this.limiter.reserve(redisKey, v4());
    } catch (error) {
      if (error instanceof SlidingWindowRedisBackend.RateLimitError) {
        throw KeyRateLimiter.RateLimitError(redisKey, error.reset, error.limit);
      }

      throw error;
    }

    return token;
  }

  async cleanup(...parts) {
    await this.limiter.cleanup(this.makeRedisKey(parts));
  }
}

KeyRateLimiter.RateLimitError = errorHelpers.generateClass('RateLimitError', { args: ['key', 'reset', 'limit'] });

module.exports = {
  KeyRateLimiter,
  ErrorRateLimiterConfig,
};
