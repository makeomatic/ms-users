const { strict: assert } = require('assert');
const Bluebird = require('bluebird');
const sinon = require('sinon');
const { startService, clearRedis } = require('../../../../config');

describe('#sliding-window-limiter', function SlidingWindowLimiterTestSuite() {
  before(() => startService.call(this));
  afterEach(() => clearRedis.call(this, true));
  after(() => clearRedis.call(this));

  describe('lua cancel param validation', () => {
    it('check token', async () => {
      const service = this.users;
      const { redis } = service;
      let error;

      try {
        await redis.slidingWindowCancel(1, 'testKEY', '');
      } catch (e) {
        error = e;
      }

      assert.ok(error);
      assert(error.message.includes('invalid `token` argument'));
    });
  });

  describe('lua param validation', () => {
    const testScript = (argName) => {
      return (testParam) => {
        it(`check ${testParam.name}`, async () => {
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

    describe('currentTime', () => {
      const tests = [
        {
          name: 'empty',
          args: [null, 10, 10, 10, 1, 'mytoken'],
        }, {
          name: 'negative',
          args: [-1, 10, 10, 10, 1, 'mytoken'],

        }, {
          name: 'not a number',
          args: ['notAnum', 10, 10, 10, 1, 'mytoken'],
        },
      ];

      tests.forEach(testScript('currentTime'));
    });

    describe('windowInterval', () => {
      const tests = [
        {
          name: 'empty',
          args: [Date.now(), null, 10, 10, 1, 'mytoken'],
        }, {
          name: 'negative',
          args: [Date.now(), -1, 10, 10, 1, 'mytoken'],
        }, {
          name: 'not a number',
          args: [Date.now(), 'notanum', 10, 10, 1, 'mytoken'],
        },
      ];

      tests.forEach(testScript('windowInterval'));
    });

    describe('windowLimit', () => {
      const tests = [
        {
          name: 'empty',
          args: [Date.now(), 10, null, 10, 1, 'mytoken'],
        }, {
          name: 'negative',
          args: [Date.now(), 10, -1, 10, 1, 'mytoken'],
        }, {
          name: 'not a number',
          args: [Date.now(), 10, 'notanumber', 10, 1, 'mytoken'],
        },
      ];

      tests.forEach(testScript('windowLimit'));
    });

    describe('blockInterval', () => {
      const tests = [
        {
          name: 'empty',
          args: [Date.now(), 10, 10, null, 1, 'mytoken'],
        }, {
          name: 'negative',
          args: [Date.now(), 10, 10, -1, 1, 'mytoken'],
        }, {
          name: 'not a number',
          args: [Date.now(), 10, 10, 'notanumber', 1, 'mytoken'],
        },
      ];

      tests.forEach(testScript('blockInterval'));
    });

    describe('reserveToken', () => {
      const tests = [
        {
          name: 'empty',
          args: [Date.now(), 10, 10, 10, null, 'mytoken'],
        }, {
          name: 'negative',
          args: [Date.now(), 10, 10, 10, -1, 'mytoken'],
        }, {
          name: 'not a number',
          args: [Date.now(), 10, 10, 10, 'notanumber', 'mytoken'],
        },
      ];

      tests.forEach(testScript('reserveToken'));
    });

    describe('token', () => {
      const tests = [
        {
          name: 'empty but reserveToken true',
          args: [Date.now(), 10, 10, 10, 1, ''],
        },
      ];

      tests.forEach(testScript('token'));
    });
  });

  describe('utils tests', () => {
    const SlidingWindowLimiter = require('../../../../../src/utils/sliding-window-limiter/redis');
    const { RateLimitError } = SlidingWindowLimiter;
    describe('internals', () => {
      const rateLimiterConfig = {
        windowInterval: 1000,
        windowLimit: 10,
        blockInterval: 12000,
      };

      it('inserts zset record', async () => {
        const service = this.users;
        const { redis } = service;
        const limiter = new SlidingWindowLimiter(redis, rateLimiterConfig);
        const { token } = await limiter.reserve('myKey', 'foooToken');

        const keyType = await redis.type('myKey');
        assert(keyType === 'zset', 'must be zset');

        const keyContents = await redis.zrange('myKey', 0, -1);
        assert.deepStrictEqual(keyContents, [`${token}`], 'should contain $token');
      });

      it('sets key ttl from blockInterval', async () => {
        const service = this.users;
        const { redis } = service;
        const limiter = new SlidingWindowLimiter(redis, rateLimiterConfig);

        await limiter.reserve('myKey', 'barToken');

        const keyTTL = await redis.ttl('myKey');
        assert(keyTTL === 12, 'ttl must be set');
      });

      it('sets key ttl from interval', async () => {
        const service = this.users;
        const { redis } = service;
        const limiter = new SlidingWindowLimiter(redis, {
          windowInterval: 1000,
          windowLimit: 10,
          blockInterval: 1000000,
        });

        await limiter.reserve('myKey2', 'barToken');

        const keyTTL = await redis.ttl('myKey2');
        assert(keyTTL === 1000, 'ttl must be set');
      });

      it('cancel token', async () => {
        const service = this.users;
        const { redis } = service;
        const limiter = new SlidingWindowLimiter(redis, rateLimiterConfig);

        await limiter.reserve('myKey', 'extraToken');
        const { token } = await limiter.reserve('myKey', 'bazToken');

        await limiter.cancel('myKey', token);

        const keyContents = await redis.zrange('myKey', 0, -1);
        assert.deepStrictEqual(keyContents, ['extraToken'], 'should not contain $token');
      });

      it('cleanup key', async () => {
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

      it('cleanup extra keys', async () => {
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

    describe('clock tick', () => {
      let clock;

      const rateLimiterConfig = {
        windowInterval: 100000,
        windowLimit: 10,
        blockInterval: 120000,
      };

      beforeEach(function replaceClock() {
        clock = sinon.useFakeTimers(200000);
      });

      afterEach(function restoreClock() {
        clock.restore();
      });

      it('usage zeroes and reset decreases', async () => {
        const service = this.users;
        const { redis } = service;
        const limiter = new SlidingWindowLimiter(redis, rateLimiterConfig);

        const tokenPromises = Bluebird.mapSeries(new Array(10), async (_, index) => {
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

        assert(usageResult.reset === null);
        assert(usageResult.usage === 0, 'should delete some records');
      });

      it('limit reach', async () => {
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

    describe('clock tick and forever block', () => {
      let clock;

      const rateLimiterConfig = {
        windowInterval: 0,
        windowLimit: 10,
        blockInterval: 0,
      };

      beforeEach(function replaceClock() {
        clock = sinon.useFakeTimers(200000);
      });

      afterEach(function restoreClock() {
        clock.restore();
      });

      it('reset is always 0 if interval or blockForever === 0', async () => {
        const service = this.users;
        const { redis } = service;
        const limiter = new SlidingWindowLimiter(redis, rateLimiterConfig);

        const tokenPromises = Bluebird.mapSeries(new Array(5), async (_, index) => {
          clock.tick(5000);
          const { token } = await limiter.reserve('myKeyForever', `fooToken${index}`);
          return token;
        });

        await tokenPromises;

        let usageResult = await limiter.check('myKeyForever');
        assert(usageResult.reset === null);

        clock.tick(5000);
        usageResult = await limiter.check('myKeyForever');
        assert(usageResult.reset === null);

        clock.tick(10000);
        usageResult = await limiter.check('myKeyForever');
        assert(usageResult.reset === null);

        // end block period
        clock.tick(120003);
        usageResult = await limiter.check('myKeyForever');

        assert(usageResult.reset === null);
        assert(usageResult.usage === 5, 'should not delete some records');
      });

      it('limit reach', async () => {
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
