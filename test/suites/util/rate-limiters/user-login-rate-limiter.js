/* global startService, clearRedis */
const Promise = require('bluebird');
const { times } = require('lodash');
const assert = require('assert');

describe('#login-rate-limiter', function loginSuite() {
  const UserIpManager = require('../../../../src/utils/user-ip-manager');

  const user = { username: 'v@makeomatic.ru', password: 'nicepassword', audience: '*.localhost' };
  const userWithValidPassword = { username: 'v@makeomatic.ru', password: 'nicepassword1', audience: '*.localhost' };

  describe('extra data cleanup', () => {
    let userIpManager;
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

      userIpManager = new UserIpManager(this.users.redis);
    });

    after(clearRedis.bind(this));

    beforeEach(async () => {
      await this.users
        .dispatch('register', { params: userWithValidPassword })
        .tap(({ user: loginUser }) => {
          userId = loginUser.id;
        });
    });

    afterEach(async () => {
      await clearRedis.bind(this, true);
    });

    it('saves user ips and deletes associated global locks', async () => {
      const userWithRemoteIP = { remoteip: '10.0.0.1', ...user };
      const userWithIPAndValidPassword = { ...userWithRemoteIP, ...userWithValidPassword };

      const promises = [];
      const ips = [];
      times(10, (index) => {
        ips.push(`10.0.0.${index}`);
        promises.push(
          this.users
            .dispatch('login', { params: { ...userWithRemoteIP, remoteip: `10.0.0.${index + 1}` } })
            .reflect()
        );
      });

      await Promise.all(promises);

      const userIps = await userIpManager.getIps(userId);
      assert(userIps.length === 10, 'should contain user ips');

      await this.users.dispatch('login', { params: userWithIPAndValidPassword });

      const userIpsAfter = await userIpManager.getIps(userId);
      assert(userIpsAfter.length === 0, 'should not contain user ips');
    });
  });
});
