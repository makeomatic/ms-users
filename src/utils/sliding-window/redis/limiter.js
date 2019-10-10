const Errors = require('common-errors');
const assert = require('assert');

const { strictEqual } = require('assert');
const assertInteger = require('../../asserts/integer');
const assertStringNotEmpty = require('../../asserts/string-not-empty');

const errorHelpers = Errors.helpers;
const RateLimitError = errorHelpers.generateClass('RateLimitError', { args: ['reset', 'limit'] });

const getHiresTimestamp = () => {
  const hrtime = process.hrtime();
  const microTimestamp = (new Date()).getTime() * 1e3;
  const hrTime = Math.ceil(hrtime[1] * 1e-3);
  return microTimestamp + hrTime;
};

/**
 * Wrapper for redis sliding window script.
 */
class SlidingWindowRedisBackend {
  constructor(redis, config) {
    assert.ok(redis, '`redis` required');
    assert.ok(config, '`config` required');

    this.emptyResponse = {
      token: null,
      usage: 0,
      limit: 0,
    };

    this.enabled = config.enabled;
    if (!config.enabled) return;

    assertInteger(config.interval, '`interval` is invalid');
    strictEqual(config.interval >= 0, true, '`interval` is invalid');

    assertInteger(config.limit, '`limit` is invalid');
    strictEqual(config.limit > 0, true, '`limit` is invalid');

    this.redis = redis;

    this.interval = config.interval * 1000;
    this.blockInterval = config.blockInterval || 0 * 1000;
    this.limit = config.limit;
  }


  async reserve(key, tokenToReserve) {
    assertStringNotEmpty(key, '`key` is invalid');
    assertStringNotEmpty(tokenToReserve, '`token` invalid');

    if (!this.enabled) return this.emptyResponse;

    const { redis } = this;
    const res = await redis
      .slidingWindowReserve(1, key, getHiresTimestamp(), this.interval, this.limit, true, tokenToReserve, this.blockInterval);

    // TODO CLEANUP
    console.log('reserve', res);

    const [usage, limit, token, reset] = res;

    if (!token) {
      throw new RateLimitError(reset, limit);
    }

    return { token, usage, limit };
  }

  async check(key) {
    assertStringNotEmpty(key, '`key` is invalid');

    if (!this.enabled) return this.emptyResponse;

    const { redis } = this;
    const res = await redis
      .slidingWindowReserve(1, key, getHiresTimestamp(), this.interval, this.limit, false, '', this.blockInterval);

    // TODO CLEANUP
    console.log('check', res);
    const [usage, limit, , reset] = res;

    return { usage, limit, reset };
  }

  async cancel(key, token) {
    assertStringNotEmpty(key, '`key` is invalid');
    assertStringNotEmpty(token, '`token` is invalid');

    if (!this.enabled) return this.emptyResponse;

    const { redis } = this;
    return redis.slidingWindowCancel(1, key, token);
  }

  async cleanup(key, ...extraKeys) {
    assertStringNotEmpty(key, '`key` is invalid');

    if (!this.enabled) return this.emptyResponse;

    const { redis } = this;
    const keyCount = 1 + extraKeys.length;

    return redis.slidingWindowCleanup(keyCount, key, ...extraKeys);
  }
}

SlidingWindowRedisBackend.RateLimitError = RateLimitError;
module.exports = SlidingWindowRedisBackend;
