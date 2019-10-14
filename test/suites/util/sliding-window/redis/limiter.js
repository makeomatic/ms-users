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

  describe('lua param validation', function luaSuite() {
    const testScript = (argName) => {
      return (testParam) => {
        it(`check ${testParam.name}`, async function test() {
          const service = this.users;
          const { redis } = service;
          let error;

          try {
            await redis.slidingWindowReserve(1, 'testKEY', ...testParam.args);
          } catch (e) {
            error = e;
          }

          assert.ok(error);
          assert(error.message.includes(`invalid \`${argName}\` argument`));
        });
      };
    };

    describe('microCurrentTime', function luaParamCurrentTimeSuite() {
      const tests = [
        {
          name: 'empty',
          args: [null, 10, 10, true, 'mytoken', 10],
        }, {
          name: 'negative',
          args: [-1, 10, 10, true, 'mytoken', 10],

        }, {
          name: 'not a number',
          args: ['notAnum', 10, 10, true, 'mytoken', 10],
        },
      ];

      tests.forEach(testScript('currentTime'));
    });

    describe('interval', function luaParamIntervalSuite() {
      const tests = [
        {
          name: 'empty',
          args: [Date.now(), null, 10, true, 'mytoken', 10],
        }, {
          name: 'negative',
          args: [7777, -1, 10, true, 'mytoken', 10],
        }, {
          name: 'not a number',
          args: [7777, 'notanum', 10, true, 'mytoken', 10],
        },
      ];

      tests.forEach(testScript('interval'));
    });

    describe('limit', function luaParamLimitSuite() {
      const tests = [
        {
          name: 'empty',
          args: [Date.now(), 10, null, true, 'mytoken', 10],
        }, {
          name: 'negative',
          args: [Date.now(), 10, -1, true, 'mytoken', 10],
        }, {
          name: 'not a number',
          args: [Date.now(), 10, 'notanumber', true, 'mytoken', 10],
        },
      ];

      tests.forEach(testScript('limit'));
    });

    describe('token', function luaParamTokenSuite() {
      const tests = [
        {
          name: 'empty but reserveToken true',
          args: [Date.now(), 10, 10, true, '', 10],
        },
      ];

      tests.forEach(testScript('token'));
    });
  });

  describe('util tests', function utilSuite() {
    const SlidingWindowLimiter = require('../../../../../src/utils/sliding-window/redis/limiter');
    const { RateLimitError } = require('../../../../../src/utils/sliding-window/rate-limiter');
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

      it('sets key ttl from blockInterval', async function testKeyTTl() {
        const service = this.users;
        const { redis } = service;
        const limiter = new SlidingWindowLimiter(redis, rateLimiterConfig);

        await limiter.reserve('myKey', 'barToken');

        const keyTTL = await redis.ttl('myKey');
        assert(keyTTL === 12, 'ttl must be set');
      });

      it('sets key ttl from interval', async function testKeyTTl() {
        const service = this.users;
        const { redis } = service;
        const limiter = new SlidingWindowLimiter(redis, {
          limit: 10,
          interval: 1000,
        });

        await limiter.reserve('myKey2', 'barToken');

        const keyTTL = await redis.ttl('myKey2');
        assert(keyTTL === 1000, 'ttl must be set');
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

      it('cleanup extra keys', async function testCancelToken() {
        const service = this.users;
        const { redis } = service;
        const limiter = new SlidingWindowLimiter(redis, rateLimiterConfig);

        const tokenPromises = Bluebird.mapSeries(new Array(5), async (_, index) => {
          const { token } = await limiter.reserve('myKey', `fooToken${index}`);
          return token;
        });

        const extraKeyTokenPromises = Bluebird.mapSeries(new Array(5), async (_, index) => {
          const { token } = await limiter.reserve('myKey_extrainfo', `fooToken${index}`);
          return token;
        });

        await tokenPromises;
        await extraKeyTokenPromises;

        await limiter.cleanup('myKey', 'myKey_extrainfo');

        const afterClean = await redis.zrange('myKey_extrainfo', 0, -1);
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
          return token;
        });

        await tokenPromises;

        let usageResult = await limiter.check('myKey');
        assert(usageResult.reset === 120000);

        clock.tick(5000);
        usageResult = await limiter.check('myKey');
        assert(usageResult.reset === 115000);

        clock.tick(10000);
        usageResult = await limiter.check('myKey');
        assert(usageResult.reset === 105000);

        // end block period
        clock.tick(120003);
        usageResult = await limiter.check('myKey');
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

        assert(error instanceof RateLimitError, 'should throw error when limit reached');
      });
    });
  });
});
