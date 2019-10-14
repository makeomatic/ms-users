/* global startService, clearRedis */
const Promise = require('bluebird');
const { times } = require('lodash');
const assert = require('assert');

describe('#login-rate-limiter', function loginSuite() {
  const UserLoginRateLimiter = require('../../../../src/utils/rate-limiters/user-login-rate-limiter');

  const user = { username: 'v@makeomatic.ru', password: 'nicepassword', audience: '*.localhost' };
  const userWithValidPassword = { username: 'v@makeomatic.ru', password: 'nicepassword1', audience: '*.localhost' };

  describe('extra data cleanup', () => {
    let rateLimiter;
    let userId;

    before(async () => {
      const rateLimiterConfigs = {
        // IP
        ipLimitEnabled: true,
        ipLimitInterval: 7 * 24 * 60 * 60,
        ipLimitAttemptsCount: 15,
        ipBlockInterval: 7 * 24 * 60 * 60,

        // User + IP
        // User + IP
        userIpLimitEnabled: true,
        userIpLimitInterval: 2 * 60 * 60,
        userIpLimitAttemptsCount: 5,
        userIpBlockInterval: 2 * 60 * 60,
      };

      await startService.call(this, {
        rateLimiters: {
          userLogin: rateLimiterConfigs,
        },
      });

      rateLimiter = new UserLoginRateLimiter(this.users.redis, rateLimiterConfigs);
    });

    after(clearRedis.bind(this));

    beforeEach(async () => {
      await this.users
        .dispatch('register', { params: userWithValidPassword })
        .tap(({ user: loginUser }) => {
          userId = loginUser.id;
        });
    });

    afterEach(clearRedis.bind(this, true));

    it('saves user ips and deletes associated global locks', async () => {
      const userWithRemoteIP = { remoteip: '10.0.0.1', ...user };
      const userWithIPAndValidPassword = { ...userWithRemoteIP, ...userWithValidPassword };

      const promises = [];
      const ips = [];
      times(4, (index) => {
        ips.push(`10.0.0.${index}`);
        promises.push(
          this.users
            .dispatch('login', { params: { ...userWithRemoteIP, remoteip: `10.0.0.${index + 1}` } })
            .reflect()
        );
      });

      await Promise.all(promises);

      const userIps = await rateLimiter.getUserIPs(userId);

      assert(userIps.length === 4, 'should contain user ips');

      await this.users.dispatch('login', { params: userWithIPAndValidPassword });

      const userIpsAfter = await rateLimiter.getUserIPs(userId);
      assert(userIpsAfter.length === 0, 'should not contain user ips');

      const globIpKeyPattern = 'gl!ip!ctr!*';

      const redisKeys = await this.users.redis.keys(`{ms-users}${globIpKeyPattern}`);
      assert(redisKeys.length === 3, 'should delete one key');
    });
  });
});
