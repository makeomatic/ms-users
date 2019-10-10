const assert = require('assert');
const Bluebird = require('bluebird');
const sinon = require('sinon');

describe('#sliding-window-limiter', function suite() {
  before(async function startService() {
    await global.startService.call(this);
  });

  afterEach(async function clearRedis() {
    await global.clearRedis.call(this, true);
  });

  after(global.clearRedis);

  describe.skip('lua param validation', function luaSuite() {
    describe('currentTime', function luaParamCurrentTimeSuite() {
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
          assert(error.message.includes('incorrect `currentTime` argument'));
        });
      });
    });

    describe('interval', function luaParamIntervalSuite() {
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
          assert(error.message.includes('incorrect `interval` argument'));
        });
      });
    });

    describe('limit', function luaParamIntervalSuite() {
      const tests = [
        {
          name: 'empty',
          args: [1, 'foo', 1, 1],
        }, {
          name: 'negative',
          args: [1, 'foo', 1, 1, -1],

        }, {
          name: 'not a number',
          args: [1, 'foo', 1, 1, 'notANum'],
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
    const SlidingWindowLimiter = require('../../../../src/utils/sliding-window/redis/limiter');

    describe('internals', function internalChecks() {
      const rateLimiterConfig = {
        limit: 10,
        interval: 1000,
        blockInterval: 12,
      };

      it('inserts zset record', async function testInserts() {
        const service = this.users;
        const { redis } = service;
        const limiter = new SlidingWindowLimiter(redis, rateLimiterConfig);
        const { token } = await limiter.reserve('myKey', 'foooToken');

        const keyType = await redis.type('myKey');
        assert(keyType === 'zset', 'must be zset');

        const keyContents = await redis.zrange('myKey', 0, -1);
        assert.deepStrictEqual(keyContents, [`${token}`], 'should contain $token');
      });

      it('sets key ttl', async function testKeyTTl() {
        const service = this.users;
        const { redis } = service;
        const limiter = new SlidingWindowLimiter(redis, rateLimiterConfig);

        await limiter.reserve('myKey', 'barToken');

        const keyTTL = await redis.ttl('myKey');
        assert(keyTTL === 12, 'ttl must be set');
      });

      it('cancel token', async function testCancelToken() {
        const service = this.users;
        const { redis } = service;
        const limiter = new SlidingWindowLimiter(redis, rateLimiterConfig);

        await limiter.reserve('myKey', 'extraToken');
        const { token } = await limiter.reserve('myKey', 'bazToken');

        await limiter.cancel('myKey', token);

        const keyContents = await redis.zrange('myKey', 0, -1);
        assert.deepStrictEqual(keyContents, ['extraToken'], 'should not contain $token');
      });

      it('cleanup key', async function testCancelToken() {
        const service = this.users;
        const { redis } = service;
        const limiter = new SlidingWindowLimiter(redis, rateLimiterConfig);

        const tokenPromises = Bluebird.mapSeries(new Array(5), async (_, index) => {
          const { token } = await limiter.reserve('myKey', `fooToken${index}`);
          return token;
        });

        await tokenPromises;

        const keyContents = await redis.zrange('myKey', 0, -1);
        assert(keyContents.length === 5, [], 'should contain tokens');

        await limiter.cleanup('myKey');

        const afterClean = await redis.zrange('myKey', 0, -1);
        assert.deepStrictEqual(afterClean, [], 'should not contain tokens');
      });
    });

    describe('clock tick', function clockTicks() {
      let clock;

      const rateLimiterConfig = {
        limit: 10,
        interval: 100,
        blockInterval: 120,
      };

      beforeEach(function replaceClock() {
        clock = sinon.useFakeTimers(200000);
      });

      afterEach(function restoreClock() {
        clock.restore();
      });

      it('usage zeroes and reset decreases', async function testUsageDrops() {
        const service = this.users;
        const { redis } = service;
        const limiter = new SlidingWindowLimiter(redis, rateLimiterConfig);

        const tokenPromises = Bluebird.mapSeries(new Array(5), async (_, index) => {
          clock.tick(5000);
          const { token } = await limiter.reserve('myKey', `fooToken${index}`);
          console.log('time', Date.now());
          return token;
        });

        await tokenPromises;

        let usageResult = await limiter.check('myKey');
        console.log(usageResult);
        assert(usageResult.reset === 120000);

        clock.tick(5000);
        usageResult = await limiter.check('myKey');
        console.log(usageResult);
        assert(usageResult.reset === 115000);

        clock.tick(10000);
        usageResult = await limiter.check('myKey');
        console.log(usageResult);
        assert(usageResult.reset === 105000);

        // end block period
        clock.tick(120003);
        usageResult = await limiter.check('myKey');
        console.log(usageResult);
        assert(usageResult.reset === 0);
        assert(usageResult.usage === 0, 'should delete some records');
      });

      it('limit reach', async function testLimit() {
        const service = this.users;
        const { redis } = service;
        const limiter = new SlidingWindowLimiter(redis, rateLimiterConfig);

        const tokenPromises = Bluebird.mapSeries(new Array(11), async (_, index) => {
          clock.tick(1000);
          await limiter.reserve('myKey', `bazToken${index}`);
        });

        let error;
        try {
          await tokenPromises;
        } catch (e) {
          error = e;
        }

        console.log(error);
        assert(error instanceof SlidingWindowLimiter.RateLimitError, 'should throw error when limit reached');
      });
    });
  });
});
