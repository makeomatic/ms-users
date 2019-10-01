const Errors = require('common-errors');
const assert = require('assert');

const { strictEqual } = require('assert');
const assertInteger = require('../asserts/integer');
const assertStringNotEmpty = require('../asserts/string-not-empty');

const errorHelpers = Errors.helpers;
const RateLimitError = errorHelpers.generateClass('RateLimitError', { args: ['reset', 'limit'] });

/**
 * Wrapper for redis sliding window script.
 */
class SlidingWindowLimiter {
  constructor(redis, interval, limit) {
    assert.ok(redis, '`redis` required');

    assertInteger(interval, '`interval` is invalid');
    strictEqual(interval >= 0, true, '`interval` is invalid');

    assertInteger(limit, '`limit` is invalid');
    strictEqual(limit > 0, true, '`limit` is invalid');


    this.redis = redis;
    this.interval = interval * 1000;
    this.limit = limit;
  }

  async reserve(key) {
    assertStringNotEmpty(key, '`key` is invalid');
    const { redis, interval, limit } = this;
    const [usage, reset, token] = await redis.sWindowReserve(1, key, interval, limit);

    if (!token || typeof token === 'undefined') {
      throw new RateLimitError(reset, limit);
    }

    return { token, usage, limit };
  }

  async check(key) {
    assertStringNotEmpty(key, '`key` is invalid');

    const { redis } = this;
    const { interval, limit } = this;
    const [usage] = await redis.sWindowReserve(1, key, interval, limit, true);

    return { usage, limit };
  }

  async cancel(key, token) {
    assertStringNotEmpty(key, '`key` is invalid');
    assertInteger(token, '`token` is invalid');

    const { redis } = this;
    return redis.sWindowCancel(1, key, token);
  }
}

SlidingWindowLimiter.RateLimitError = RateLimitError;
module.exports = SlidingWindowLimiter;
