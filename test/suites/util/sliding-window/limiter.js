const assert = require('assert');
const Bluebird = require('bluebird');

const SlidingWindowLimiter = require('../../../../src/utils/sliding-window/limiter');

describe('#sliding-window-limiter', function suite() {
  before(async function startService() {
    await global.startService.call(this);
  });

  afterEach(async function clearRedis() {
    await global.clearRedis.call(this, true);
  });

  after(global.clearRedis);

  describe('lua param validation', function luaSuite() {
    describe('interval', function luaParamIntervalSuite() {
      const tests = [
        {
          name: 'empty',
          args: [1, 'foo'],
        }, {
          name: 'negative',
          args: [1, 'foo', -1],

        }, {
          name: 'not a number',
          args: [1, 'foo', 'notANum'],
        },
      ];

      tests.forEach((testParam) => {
        it(`check ${testParam.name}`, async function test() {
          const service = this.users;
          const { redis } = service;
          let error;
          try {
            await redis.sWindowReserve(...testParam.args);
          } catch (e) {
            error = e;
          }
          assert.ok(error);
          assert(error.message.includes('incorrect `interval` argument'));
        });
      });
    });

    describe('limit', function luaParamIntervalSuite() {
      const tests = [
        {
          name: 'empty',
          args: [1, 'foo', 1],
        }, {
          name: 'negative',
          args: [1, 'foo', 1, -1],

        }, {
          name: 'not a number',
          args: [1, 'foo', 1, 'notANum'],
        },
      ];

      tests.forEach((testParam) => {
        it(`check ${testParam.name}`, async function test() {
          const service = this.users;
          const { redis } = service;
          let error;
          try {
            await redis.sWindowReserve(...testParam.args);
          } catch (e) {
            error = e;
          }
          assert.ok(error);
          assert(error.message.includes('incorrect `limit` argument'));
        });
      });
    });
  });

  describe('util tests', function utilSuite() {
    it('inserts zset record', async function testInserts() {
      const service = this.users;
      const { redis } = service;
      const limiter = new SlidingWindowLimiter(redis, 1000, 10);
      const { token } = await limiter.reserve('myKey');

      const keyType = await redis.type('myKey');
      assert(keyType === 'zset', 'must be zset');

      const keyContents = await redis.zrange('myKey', 0, -1);
      assert.deepStrictEqual(keyContents, [`${token}`], 'should contain $token');
    });

    it('sets key ttl', async function testKeyTTl() {
      const service = this.users;
      const { redis } = service;
      const limiter = new SlidingWindowLimiter(redis, 30, 10);
      await limiter.reserve('myKey');

      const keyTTL = await redis.ttl('myKey');
      assert(keyTTL === 30, 'ttl must be set');
    });

    it('cancel token', async function testCancelToken() {
      const service = this.users;
      const { redis } = service;
      const limiter = new SlidingWindowLimiter(redis, 1000, 10);
      const { token } = await limiter.reserve('myKey');

      await limiter.cancel('myKey', token);

      const keyContents = await redis.zrange('myKey', 0, -1);
      assert.deepStrictEqual(keyContents, [], 'should not contain $token');
    });

    it('usage drops on time change', async function testUsageDrops() {
      const service = this.users;
      const { redis } = service;
      const limiter = new SlidingWindowLimiter(redis, 1, 10);

      const tokenPromises = Bluebird.mapSeries(new Array(5), async () => {
        await Bluebird.delay(100);
        const { token } = await limiter.reserve('myKey');
        return token;
      });

      await tokenPromises;

      await Bluebird.delay(700);
      const usageResult = await limiter.check('myKey');
      assert(usageResult.usage < 5, 'should delete some records');
    });

    it('check and reset', async function testcheck() {
      const service = this.users;
      const { redis } = service;
      const limiter = new SlidingWindowLimiter(redis, 10, 10);

      const tokenPromises = Bluebird.mapSeries(new Array(9), async () => {
        await limiter.reserve('myKey');
      });

      await tokenPromises;
      await Bluebird.delay(1000);

      const usageResult = await limiter.check('myKey');
      assert(usageResult.reset < 10);
    });

    it('limit reach', async function testLimit() {
      const service = this.users;
      const { redis } = service;
      const limiter = new SlidingWindowLimiter(redis, 10, 10);

      const tokenPromises = Bluebird.mapSeries(new Array(11), async () => {
        await limiter.reserve('myKey');
      });

      let error;
      try {
        await tokenPromises;
      } catch (e) {
        error = e;
      }
      assert(error instanceof SlidingWindowLimiter.RateLimitError, 'should throw error when limit reached');
    });
  });
});
