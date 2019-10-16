/* global startService, clearRedis */
const Promise = require('bluebird');
const { times } = require('lodash');
const assert = require('assert');
const UserLoginRateLimiter = require('../../../../src/utils/rate-limiters/user-login-rate-limiter');

describe('#login-rate-limiter', function rateLimiterSuite() {
  const user = { username: 'v@makeomatic.ru', password: 'nicepassword', audience: '*.localhost' };
  const userWithValidPassword = { username: 'v@makeomatic.ru', password: 'nicepassword1', audience: '*.localhost' };

  describe('extra data cleanup', () => {
    let userId;

    before(async () => {
      await startService.call(this);
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
      const { redis } = this.users;
      const userLoginRateLimiter = new UserLoginRateLimiter(redis, this.users.config.rateLimiters.userLogin);
      const userWithRemoteIP = { remoteip: '10.0.0.1', ...user };
      const userWithIPAndValidPassword = { ...userWithRemoteIP, ...userWithValidPassword };
      const promises = [];
      const ips = [];

      times(10, (index) => {
        ips.push(`10.0.0.${index + 1}`);
        promises.push(
          this.users
            .dispatch('login', { params: { ...userWithRemoteIP, remoteip: `10.0.0.${index + 1}` } })
            .reflect()
        );
      });

      await Promise.all(promises);
      await this.users.dispatch('login', { params: userWithIPAndValidPassword });

      const usersIpBlockUsage = await userLoginRateLimiter.checkForUserIp(userId, '10.0.0.1');
      assert(usersIpBlockUsage.usage === 0);

      const otherIpBlockUsage = await userLoginRateLimiter.checkForUserIp(userId, '10.0.0.2');
      assert(otherIpBlockUsage.usage === 0);
    });
  });
});
