/* global startService, clearRedis */
const { inspectPromise } = require('@makeomatic/deploy');
const Promise = require('bluebird');
const { expect } = require('chai');
const { times } = require('lodash');

describe('#login-rate-limits', function loginSuite() {
  const UserIpRateLimiter = require('../../src/utils/rate-limiters/user-ip-rate-limiter');

  const user = { username: 'v@makeomatic.ru', password: 'nicepassword', audience: '*.localhost' };
  const userWithValidPassword = { username: 'v@makeomatic.ru', password: 'nicepassword1', audience: '*.localhost' };

  describe.skip('ip rate limiter enabled', () => {
    let rateLimiter;

    before(async () => {
      const rateLimiterConfigs = {
        loginGlobalIp: {
          enabled: true,
          limit: 15,
          interval: 7 * 24 * 60 * 60,
        },
        loginUserIp: {
          enabled: false,
        },
      };

      await startService.call(this, {
        rateLimiters: rateLimiterConfigs,
      });

      rateLimiter = new UserIpRateLimiter(this.users.redis, rateLimiterConfigs.loginGlobalIp, rateLimiterConfigs.loginUserIp);
    });

    after(clearRedis.bind(this));

    beforeEach(async () => {
      await this.users
        .dispatch('register', { params: userWithValidPassword });
    });

    afterEach(clearRedis.bind(this, true));

    it('must lock ip for login completely after 15 attempts', async () => {
      const userWithRemoteIP = { remoteip: '10.0.0.1', ...user, username: 'doesnt_exist' };
      const promises = [];
      const eMsg = 'You are locked from making login attempts for the next 7 days from ipaddress \'10.0.0.1\'';

      times(16, () => {
        promises.push((
          this.users
            .dispatch('login', { params: { ...userWithRemoteIP } })
            .reflect()
            .then(inspectPromise(false))
        ));
      });

      const errors = await Promise.all(promises);
      const Http404 = errors.filter((x) => x.statusCode === 404 && x.name === 'HttpStatusError');
      const Http429 = errors.filter((x) => x.statusCode === 429 && x.name === 'HttpStatusError');

      expect(Http404.length).to.be.eq(15);
      expect(Http429.length).to.be.eq(1);

      const Http429Error = Http429[0];
      expect(Http429Error.message).to.be.eq(eMsg);
    });

    it('resets attempts after final success login', () => {
      const userWithRemoteIP = { remoteip: '10.0.0.1', ...user, username: 'doesnt_exist' };
      const userWithIPAndValidPassword = { ...userWithRemoteIP, ...userWithValidPassword };

      const promises = [];

      times(14, () => {
        promises.push((
          this.users
            .dispatch('login', { params: { ...userWithRemoteIP } })
            .reflect()
            .then(inspectPromise(false))
            .then((login) => {
              expect(login.statusCode).to.be.eq(404);
            })
        ));
      });

      promises.push((
        this.users
          .dispatch('login', { params: userWithIPAndValidPassword })
          .reflect()
          .then(inspectPromise(true))
          .then(async () => {
            const checkResult = await rateLimiter.checkForIp(userWithRemoteIP.remoteip);
            console.log(checkResult);
            expect(checkResult.usage).to.be.eq(0);
          })
      ));

      return Promise.all(promises);
    });
  });

  describe('user rate limiter enabled', () => {
    let rateLimiter;

    before(async () => {
      const rateLimiterConfigs = {
        loginUserIp: {
          enabled: true,
          interval: 2 * 60 * 60,
          limit: 5,
        },
        loginGlobalIp: {
          enabled: false,
        },
      };

      await startService.call(this, {
        rateLimiters: rateLimiterConfigs,
      });

      rateLimiter = new UserIpRateLimiter(this.users.redis, rateLimiterConfigs.loginGlobalIp, rateLimiterConfigs.loginUserIp);
    });

    after(clearRedis.bind(this));

    beforeEach(async () => {
      await this.users
        .dispatch('register', { params: userWithValidPassword });
    });

    afterEach(clearRedis.bind(this, true));

    it('must lock account for authentication after 5 invalid login attemps', () => {
      const userWithRemoteIP = { remoteip: '10.0.0.1', ...user };
      const promises = [];
      const eMsg = 'You are locked from making login attempts for the next 2 hours from ipaddress \'10.0.0.1\'';

      times(5, () => {
        promises.push((
          this.users
            .dispatch('login', { params: { ...userWithRemoteIP } })
            .reflect()
            .then(inspectPromise(false))
            .then((login) => {
              expect(login.name).to.be.eq('HttpStatusError');
              expect(login.statusCode).to.be.eq(403);
            })
        ));
      });

      promises.push((
        this.users
          .dispatch('login', { params: { ...userWithRemoteIP } })
          .reflect()
          .then(inspectPromise(false))
          .then((login) => {
            expect(login.name).to.be.eq('HttpStatusError');
            expect(login.statusCode).to.be.eq(429);
            expect(login.message).to.be.eq(eMsg);
          })
      ));

      return Promise.all(promises);
    });

    it('resets attempts after final success login', () => {
      const userWithRemoteIP = { remoteip: '10.0.0.1', ...user };
      const userWithIPAndValidPassword = { ...userWithRemoteIP, ...userWithValidPassword };

      const promises = [];

      times(4, () => {
        promises.push((
          this.users
            .dispatch('login', { params: { ...userWithRemoteIP } })
            .reflect()
            .then(inspectPromise(false))
            .then((login) => {
              expect(login.name).to.be.eq('HttpStatusError');
              expect(login.statusCode).to.be.eq(403);
            })
        ));
      });

      promises.push((
        this.users
          .dispatch('login', { params: userWithIPAndValidPassword })
          .reflect()
          .then(inspectPromise(true))
          .then(async ({ user: loginUser }) => {
            const checkResult = await rateLimiter.checkForUserIp(loginUser.id, userWithRemoteIP.remoteip);
            expect(checkResult.usage).to.be.eq(0);
          })
      ));

      return Promise.all(promises);
    });
  });
});
