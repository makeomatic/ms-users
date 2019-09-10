const toSeconds = (val) => Math.ceil(val / 1e6);
const toMilliSec = (val) => val * 1000;

/**
 * Attempts to get 'token' in sliding window
 * Null result.token means that use limit for 'key' is exceeded
 * @param {ioredis} redis
 * @param {string} key
 * @param {int} interval - sliding window size in seconds
 * @param {int} limit - number of attempts/tokens available in 'interval'
 * @returns {Promise<{token? string, usage: int, reset?: int}>}
 */
async function reserve(redis, key, interval, limit) {
  const [token, usage, reset] = await redis.sWindowReserve(1, key, toMilliSec(interval), limit);
  return {
    token,
    usage,
    reset: toSeconds(reset),
  };
}

/**
 * Returns {usage:int, reset:int} for provided 'key'
 * @param {ioredis} redis
 * @param {string} key
 * @param {int} interval - sliding window size in seconds
 * @param {int} limit - number of attempts/tokens available in 'interval'
 * @returns {Promise<{usage: int, reset?: int}>}
 */
async function check(redis, key, interval, limit) {
  const [usage, reset] = await redis.sWindowCheck(1, key, toMilliSec(interval), limit);
  return {
    usage,
    reset: toSeconds(reset),
  };
}

/**
 * Removes token/attempt from sliding window 'key'
 * @param {ioredis} redis
 * @param {string} key
 * @param {string} token
 * @returns {Promise<*>}
 */
async function cancel(redis, key, token) {
  return redis.sWindowCancel(1, key, token);
}

module.exports = {
  reserve,
  check,
  cancel,
};
