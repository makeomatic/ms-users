const { helpers: errorHelpers } = require('common-errors');
const { strictEqual } = require('assert');
const assertInteger = require('../../asserts/integer');
const assertStringNotEmpty = require('../../asserts/string-not-empty');

/**
 * Class providing sliding window based blocks using Redis database as storage.
 */
class SlidingWindowRedisBackend {
  /**
   * Create Sliding Window Redis Backend
   * @param {ioredis} redis - Redis Database connection
   * @param {object} config - Sliding window configuration
   */
  constructor(redis, config) {
    const { windowInterval, windowLimit, blockInterval } = config;

    assertInteger(windowInterval, '`interval` is invalid');
    strictEqual(windowInterval >= 0, true, '`interval` is invalid');
    assertInteger(windowLimit, '`attempts` is invalid');
    strictEqual(windowLimit > 0, true, '`attempts` is invalid');
    assertInteger(blockInterval, '`interval` is invalid');
    strictEqual(windowInterval === 0 ? blockInterval === 0 : blockInterval > 0, true, '`attempts` is invalid');

    this.config = config;
    this.redis = redis;
  }

  static STATUS_FOREVER = 0;

  static RateLimitError = errorHelpers.generateClass('RateLimitError', { args: ['reset', 'limit'] });

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
    const { windowInterval, windowLimit, blockInterval } = config;
    const [usage, limit, token, reset] = await redis
      .slidingWindowReserve(1, key, Date.now(), windowInterval, windowLimit, 1, tokenToReserve, blockInterval);

    /* reset becomes 0 if blocking forever */
    if (!token) {
      throw SlidingWindowRedisBackend.RateLimitError(reset, limit);
    }

    return { token, usage, limit };
  }

  /**
   * Checks whether token reservation is possible.
   * @param {string} key - Redis ZSET key
   * @returns {Promise<{usage: *, limit: *, reset: *}>}
   */
  async check(key) {
    assertStringNotEmpty(key, '`key` is invalid');

    const { redis, config } = this;
    const { windowInterval, windowLimit, blockInterval } = config;
    const [usage, limit, , reset] = await redis
      .slidingWindowReserve(1, key, Date.now(), windowInterval, windowLimit, 0, '', blockInterval);

    return { usage, limit, reset };
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
}

module.exports = SlidingWindowRedisBackend;
