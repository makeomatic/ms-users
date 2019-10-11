const assert = require('assert');

const { strictEqual } = require('assert');
const assertInteger = require('../../asserts/integer');
const assertStringNotEmpty = require('../../asserts/string-not-empty');

const { RateLimitError } = require('../rate-limiter');

const getHiresTimestamp = () => {
  const hrtime = process.hrtime();
  const microTimestamp = (new Date()).getTime() * 1e3;
  const hrTime = Math.ceil(hrtime[1] * 1e-3);
  return microTimestamp + hrTime;
};

/**
 * Class providing sliding window based blocks using Redis database as storage.
 */
class SlidingWindowRedisBackend {
  /**
   * Create Sliding Window Redis Backend
   * @param {ioredis} redis - Redis Database connection
   * @param {object} config - Ratelimiter configuration
   */
  constructor(redis, config) {
    assert.ok(redis, '`redis` required');
    assert.ok(config, '`config` required');

    assertInteger(config.interval, '`interval` is invalid');
    strictEqual(config.interval >= 0, true, '`interval` is invalid');
    assertInteger(config.limit, '`limit` is invalid');
    strictEqual(config.limit > 0, true, '`limit` is invalid');

    this.redis = redis;

    const { interval, blockInterval, ...restConfig } = config;
    /* Convert interval to milliseconds */
    this.config = {
      interval: interval * 1000,
      blockInterval: (blockInterval || interval) * 1000,
      ...restConfig,
    };
  }

  /**
   * Tries to reserve provided token.
   * @param {string} key - Redis ZSET key
   * @param {string} tokenToReserve
   * @throws {RateLimitError}
   * @returns {Promise<{usage: number, limit: number, token: null}|*|{usage: *, limit: *, token: *}>}
   */
  async reserve(key, tokenToReserve) {
    assertStringNotEmpty(key, '`key` is invalid');
    assertStringNotEmpty(tokenToReserve, '`token` invalid');

    const { redis, config } = this;
    const [usage, limit, token, reset] = await redis
      .slidingWindowReserve(1, key, getHiresTimestamp(), config.interval, config.limit, true, tokenToReserve, config.blockInterval);

    if (reset) {
      throw new RateLimitError(reset, limit);
    }

    return {
      token,
      usage,
      limit,
    };
  }

  /**
   * Checks whether token reservation is possible.
   * @param {string} key - Redis ZSET key
   * @returns {Promise<{usage: *, limit: *, reset: *}>}
   */
  async check(key) {
    assertStringNotEmpty(key, '`key` is invalid');

    const { redis, config } = this;
    const [usage, limit, , reset] = await redis
      .slidingWindowReserve(1, key, getHiresTimestamp(), config.interval, config.limit, false, '', config.blockInterval);

    return {
      usage,
      limit,
      reset,
    };
  }

  /**
   * Cancels token reservation.
   * @param {string} key - Redis ZSET key
   * @param {string} token
   * @returns {Promise<void>}
   */
  async cancel(key, token) {
    assertStringNotEmpty(key, '`key` is invalid');
    assertStringNotEmpty(token, '`token` is invalid');

    const { redis } = this;
    return redis.slidingWindowCancel(1, key, token);
  }

  /**
   * Deletes all entries from provided `key`.
   * Deletes records taken from `key` if they exists in `extrakeys[]`.
   * @param {string} key
   * @param {string[]} extraKeys
   * @returns {Promise<void>}
   */
  async cleanup(key, ...extraKeys) {
    assertStringNotEmpty(key, '`key` is invalid');

    const { redis } = this;
    const keyCount = 1 + extraKeys.length;

    return redis.slidingWindowCleanup(keyCount, key, ...extraKeys);
  }

  isEnabled() {
    return this.config.enabled;
  }
}

module.exports = SlidingWindowRedisBackend;
