/* global startService, clearRedis */
const { inspectPromise } = require('@makeomatic/deploy');
const Promise = require('bluebird');
const { expect } = require('chai');
const { times } = require('lodash');

describe('#login-rate-limits', function loginSuite() {
  const UserLoginRateLimiter = require('../../src/utils/rate-limiters/user-login-rate-limiter');

  const user = { username: 'v@makeomatic.ru', password: 'nicepassword', audience: '*.localhost' };
  const userWithValidPassword = { username: 'v@makeomatic.ru', password: 'nicepassword1', audience: '*.localhost' };

  describe('positive interval', () => {
    let rateLimiter;

    before(async () => {
      const rateLimiterConfigs = {
        enabled: true,
        forIp: {
          interval: 60 * 60 * 24, // 24 hours
          attempts: 15,
          blockInterval: 60 * 60 * 24 * 7, // 7 days
        },
        forUserIp: {
          interval: 60 * 60 * 24, // 24 hours
          attempts: 5,
          blockInterval: 60 * 60 * 24, // 1 day
        },
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
        .dispatch('register', { params: userWithValidPassword });
    });

    afterEach(clearRedis.bind(this, true));

    it('must lock ip for login completely after 15 attempts', async () => {
      const userWithRemoteIP = { remoteip: '10.0.0.1', ...user, username: 'doesnt_exist' };
      const promises = [];
      const eMsg = 'You are locked from making login attempts for 7 days from ipaddress \'10.0.0.1\'';

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

    it('must lock account for authentication after 5 invalid login attemps', async () => {
      const userWithRemoteIP = { remoteip: '10.0.0.1', ...user };
      const promises = [];
      const eMsg = 'You are locked from making login attempts for a day from ipaddress \'10.0.0.1\'';

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

      await Promise.all(promises);

      await this.users
        .dispatch('login', { params: { ...userWithRemoteIP } })
        .reflect()
        .then(inspectPromise(false))
        .then((login) => {
          expect(login.name).to.be.eq('HttpStatusError');
          expect(login.statusCode).to.be.eq(429);
          expect(login.message).to.be.eq(eMsg);
        });
    });

    it('resets attempts after final success login', async () => {
      const userWithRemoteIP = { remoteip: '10.0.0.1', ...user, username: 'doesnt_exist' };
      const userWithIPAndValidPassword = { ...userWithRemoteIP, ...userWithValidPassword };

      const promises = [];

      times(10, () => {
        promises.push(
          this.users
            .dispatch('login', { params: { ...userWithRemoteIP } })
            .reflect()
        );
      });

      await Promise.all(promises);
      await this.users.dispatch('login', { params: userWithIPAndValidPassword });

      const checkResult = await rateLimiter.checkForIp(userWithRemoteIP.remoteip);
      expect(checkResult.usage).to.be.eq(0);
    });
  });

  describe('ip rate limiter enabled block forever', () => {
    before(async () => {
      const rateLimiterConfigs = {
        enabled: true,
        forIp: {
          interval: 0,
          attempts: 15,
          blockInterval: 0,
        },
        forUserIp: {
          interval: 0,
          attempts: 5,
          blockInterval: 0,
        },
      };

      await startService.call(this, {
        rateLimiters: {
          userLogin: rateLimiterConfigs,
        },
      });
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
      const eMsg = 'You are locked from making login attempts forever from ipaddress \'10.0.0.1\'';

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

    it('must lock account for authentication after 5 invalid login attemps', async () => {
      const userWithRemoteIP = { remoteip: '10.0.0.1', ...user };
      const promises = [];
      const eMsg = 'You are locked from making login attempts forever from ipaddress \'10.0.0.1\'';

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

      await Promise.all(promises);

      await this.users
        .dispatch('login', { params: { ...userWithRemoteIP } })
        .reflect()
        .then(inspectPromise(false))
        .then((login) => {
          expect(login.name).to.be.eq('HttpStatusError');
          expect(login.statusCode).to.be.eq(429);
          expect(login.message).to.be.eq(eMsg);
        });

      return Promise.all(promises);
    });
  });
});
