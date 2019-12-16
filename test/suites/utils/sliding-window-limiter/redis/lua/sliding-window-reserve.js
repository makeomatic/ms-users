/* global startService */
/* global clearRedis */
const { rejects, strictEqual, deepStrictEqual } = require('assert');
const Promise = require('bluebird');

describe('redis.slidingWindowReserve script', function suite() {
  before(startService);
  after(clearRedis);

  it('should be able to throw error if params are invalid', async () => {
    const { redis } = this.ctx.users;

    await rejects(async () => redis.slidingWindowReserve(), /^ReplyError: ERR wrong number of arguments for 'evalsha' command$/);

    // invalid number of keys
    await rejects(async () => redis.slidingWindowReserve(''), /^ReplyError: ERR value is not an integer or out of range$/);
    await rejects(async () => redis.slidingWindowReserve(null), /^ReplyError: ERR value is not an integer or out of range$/);
    await rejects(async () => redis.slidingWindowReserve('perchik'), /^ReplyError: ERR value is not an integer or out of range$/);
    await rejects(async () => redis.slidingWindowReserve(true), /^ReplyError: ERR value is not an integer or out of range$/);

    // invalid redis key argument
    await rejects(async () => redis.slidingWindowReserve(1), /^ReplyError: invalid `tokenDbKey` argument$/);
    await rejects(async () => redis.slidingWindowReserve(1, ''), /^ReplyError: invalid `tokenDbKey` argument$/);

    // invalid current time argument
    await rejects(async () => redis.slidingWindowReserve(1, 'perchik'), /^ReplyError: invalid `currentTime` argument$/);
    await rejects(async () => redis.slidingWindowReserve(1, 'perchik', 0), /^ReplyError: invalid `currentTime` argument$/);
    await rejects(async () => redis.slidingWindowReserve(1, 'perchik', -1), /^ReplyError: invalid `currentTime` argument$/);
    await rejects(async () => redis.slidingWindowReserve(1, 'perchik', 'fat'), /^ReplyError: invalid `currentTime` argument$/);

    // invalid window interval argument
    await rejects(async () => redis.slidingWindowReserve(1, 'perchik', 1576335000000), /^ReplyError: invalid `windowInterval` argument$/);
    await rejects(async () => redis.slidingWindowReserve(1, 'perchik', 1576335000000, -1), /^ReplyError: invalid `windowInterval` argument$/);
    await rejects(async () => redis.slidingWindowReserve(1, 'perchik', 1576335000000, 'fat'), /^ReplyError: invalid `windowInterval` argument$/);

    // invalid window limit argument
    await rejects(async () => redis.slidingWindowReserve(1, 'perchik', 1576335000000, 0), /^ReplyError: invalid `windowLimit` argument$/);
    await rejects(async () => redis.slidingWindowReserve(1, 'perchik', 1576335000000, 0, 0), /^ReplyError: invalid `windowLimit` argument$/);
    await rejects(async () => redis.slidingWindowReserve(1, 'perchik', 1576335000000, 0, -1), /^ReplyError: invalid `windowLimit` argument$/);
    await rejects(async () => redis.slidingWindowReserve(1, 'perchik', 1576335000000, 0, 'fat'), /^ReplyError: invalid `windowLimit` argument$/);

    // invalid block interval argument
    await rejects(async () => redis.slidingWindowReserve(1, 'perchik', 1576335000000, 0, 1), /^ReplyError: invalid `blockInterval` argument$/);
    await rejects(async () => redis.slidingWindowReserve(1, 'perchik', 1576335000000, 0, 1, -1), /^ReplyError: invalid `blockInterval` argument$/);
    await rejects(async () => redis.slidingWindowReserve(1, 'perchik', 1576335000000, 0, 1, 'fat'), /^ReplyError: invalid `blockInterval` argument$/);

    // invalid reserve token argument
    await rejects(async () => redis.slidingWindowReserve(1, 'perchik', 1576335000000, 0, 1, 0), /^ReplyError: invalid `reserveToken` argument$/);
    await rejects(async () => redis.slidingWindowReserve(1, 'perchik', 1576335000000, 0, 1, 0, -1), /^ReplyError: invalid `reserveToken` argument$/);
    await rejects(async () => redis.slidingWindowReserve(1, 'perchik', 1576335000000, 0, 1, 0, 'fat'), /^ReplyError: invalid `reserveToken` argument$/);

    // invalid token argument
    await rejects(async () => redis.slidingWindowReserve(1, 'perchik', 1576335000000, 0, 1, 0, 1), /^ReplyError: invalid `token` argument$/);
    await rejects(async () => redis.slidingWindowReserve(1, 'perchik', 1576335000000, 0, 1, 0, 1, ''), /^ReplyError: invalid `token` argument$/);

    // if window interval equals 0 then block interval has no sense
    await rejects(async () => redis.slidingWindowReserve(1, 'perchik', 1576335000000, 0, 1, 10, 0), /^ReplyError: `blockInterval` has no sense if `windowInterval` is gt 0$/);
  });

  describe('should be able to works well if window interval equals 0', () => {
    it('should be able to reserve token if key is not exist', async () => {
      const { redis } = this.ctx.users;

      deepStrictEqual(
        await redis.slidingWindowReserve(1, 'empty:key:case0', 1576335000000, 0, 1, 0, 1, 'token1'),
        [1, 1, 'token1', 0]);
      strictEqual(await redis.pttl('empty:key:case0'), -1);
    });

    it('should be able to reserve token if key already exists', async () => {
      const { redis } = this.ctx.users;

      await redis.zadd('exists:key:case0', 1576334999999, 'token1');

      deepStrictEqual(
        await redis.slidingWindowReserve(1, 'exists:key:case0', 1576335000000, 0, 2, 0, 1, 'token2'),
        [2, 2, 'token2', 0]);
      strictEqual(await redis.pttl('exists:key:case0'), -1);
    });

    // depends on previous test
    it('should be able to return null as token if limit is reached', async () => {
      const { redis } = this.ctx.users;

      deepStrictEqual(
        await redis.slidingWindowReserve(1, 'exists:key:case0', 1576335000001, 0, 2, 0, 1, 'token3'),
        [2, 2, null, 0]);
      strictEqual(await redis.pttl('exists:key:case0'), -1);
    });

    // depends on previous test
    it('should be able to return info about sliding window', async () => {
      const { redis } = this.ctx.users;

      deepStrictEqual(
        await redis.slidingWindowReserve(1, 'exists:key:case0', 1576335000002, 0, 2, 0, 0),
        [2, 2, null, 0]);
      strictEqual(await redis.pttl('exists:key:case0'), -1);
    });

    // depends on previous test
    it('should not be able to reserve token after block interval (key should never expired)', async () => {
      const { redis } = this.ctx.users;

      await Promise.delay(3000);

      deepStrictEqual(
        await redis.slidingWindowReserve(1, 'exists:key:case0', 1576335001000, 0, 2, 0, 1, 'token4'),
        [2, 2, null, 0]);
      strictEqual(await redis.pttl('exists:key:case0'), -1);
    });
  });

  describe('should be able to works well if window is greater than 0, block interval gt window interval', () => {
    it('should be able to reserve token if key is not exist', async () => {
      const { redis } = this.ctx.users;

      deepStrictEqual(
        await redis.slidingWindowReserve(1, 'empty:key:case1', 1576335000000, 1000, 1, 2000, 1, 'token1'),
        [1, 1, 'token1', 2000]);
      strictEqual(await redis.pttl('empty:key:case1') > 1950, true);
    });

    it('should be able to reserve token if key already exists', async () => {
      const { redis } = this.ctx.users;

      await redis.zadd('exists:key:case1', 1576334999999, 'token1');

      deepStrictEqual(
        await redis.slidingWindowReserve(1, 'exists:key:case1', 1576335000000, 1000, 2, 2000, 1, 'token2'),
        [2, 2, 'token2', 2000]);
      strictEqual(await redis.pttl('exists:key:case1') > 1950, true);
    });

    // depends on previous test
    it('should be able to return null as token if limit is reached', async () => {
      const { redis } = this.ctx.users;

      deepStrictEqual(
        await redis.slidingWindowReserve(1, 'exists:key:case1', 1576335000001, 1000, 2, 2000, 1, 'token3'),
        [2, 2, null, 1999]);
      strictEqual(await redis.pttl('exists:key:case1') > 1950, true);
    });

    // depends on previous test
    it('should be able to return info about sliding window', async () => {
      const { redis } = this.ctx.users;

      deepStrictEqual(
        await redis.slidingWindowReserve(1, 'exists:key:case1', 1576335000002, 1000, 2, 2000, 0),
        [2, 2, null, 1998]);
      strictEqual(await redis.pttl('exists:key:case1') > 1950, true);
    });

    // depends on previous test
    it('should be able to reserve token in another window interval', async () => {
      const { redis } = this.ctx.users;

      await Promise.delay(2000);

      deepStrictEqual(
        await redis.slidingWindowReserve(1, 'exists:key:case1', 1576335005000, 1000, 2, 2000, 1, 'token4'),
        [1, 2, 'token4', null]);
      strictEqual(await redis.pttl('exists:key:case1') > 1950, true);
    });

    // depends on previous test
    it('should be able to get info in another window interval', async () => {
      const { redis } = this.ctx.users;

      deepStrictEqual(
        await redis.slidingWindowReserve(1, 'exists:key:case1', 1576335005001, 1000, 2, 2000, 0),
        [1, 2, null, null]);
      strictEqual(await redis.pttl('exists:key:case1') > 1950, true);
    });

    // depends on previous test
    it('should be able to get info in empty window interval', async () => {
      const { redis } = this.ctx.users;

      await Promise.delay(2000);

      deepStrictEqual(
        await redis.slidingWindowReserve(1, 'exists:key:case1', 1576335010000, 1000, 2, 2000, 0),
        [0, 2, null, null]);
      strictEqual(await redis.pttl('exists:key:case1'), -2);
    });
  });

  describe('should be able to works well if window is greater than 0, block interval lt window interval', () => {
    it('should be able to reserve token if key is not exist', async () => {
      const { redis } = this.ctx.users;

      deepStrictEqual(
        await redis.slidingWindowReserve(1, 'empty:key:case1', 1576335000000, 2000, 1, 1000, 1, 'token1'),
        [1, 1, 'token1', 1000]);
      strictEqual(await redis.pttl('empty:key:case1') > 950, true);
    });

    it('should be able to reserve token if key already exists', async () => {
      const { redis } = this.ctx.users;

      await redis.zadd('exists:key:case1', 1576334999999, 'token1');

      deepStrictEqual(
        await redis.slidingWindowReserve(1, 'exists:key:case1', 1576335000000, 2000, 2, 1000, 1, 'token2'),
        [2, 2, 'token2', 1000]);
      strictEqual(await redis.pttl('exists:key:case1') > 950, true);
    });

    // depends on previous test
    it('should be able to return null as token if limit is reached', async () => {
      const { redis } = this.ctx.users;

      deepStrictEqual(
        await redis.slidingWindowReserve(1, 'exists:key:case1', 1576335000001, 2000, 2, 1000, 1, 'token3'),
        [2, 2, null, 999]);
      strictEqual(await redis.pttl('exists:key:case1') > 950, true);
    });

    // depends on previous test
    it('should be able to return info about sliding window', async () => {
      const { redis } = this.ctx.users;

      deepStrictEqual(
        await redis.slidingWindowReserve(1, 'exists:key:case1', 1576335000002, 2000, 2, 1000, 0),
        [2, 2, null, 998]);
      strictEqual(await redis.pttl('exists:key:case1') > 950, true);
    });

    // depends on previous test
    it('should be able to reserve token in another window interval', async () => {
      const { redis } = this.ctx.users;

      await Promise.delay(2000);

      deepStrictEqual(
        await redis.slidingWindowReserve(1, 'exists:key:case1', 1576335005000, 2000, 2, 1000, 1, 'token4'),
        [1, 2, 'token4', null]);
      strictEqual(await redis.pttl('exists:key:case1') > 950, true);
    });

    // depends on previous test
    it('should be able to get info in another window interval', async () => {
      const { redis } = this.ctx.users;

      deepStrictEqual(
        await redis.slidingWindowReserve(1, 'exists:key:case1', 1576335005001, 2000, 2, 1000, 0),
        [1, 2, null, null]);
      strictEqual(await redis.pttl('exists:key:case1') > 950, true);
    });

    // depends on previous test
    it('should be able to get info in empty window interval', async () => {
      const { redis } = this.ctx.users;

      await Promise.delay(1000);

      deepStrictEqual(
        await redis.slidingWindowReserve(1, 'exists:key:case1', 1576335010000, 2000, 2, 1000, 0),
        [0, 2, null, null]);
      strictEqual(await redis.pttl('exists:key:case1'), -2);
    });
  });
});
