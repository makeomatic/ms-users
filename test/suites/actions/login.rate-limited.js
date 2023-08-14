const { strictEqual, strict: assert } = require('assert');
const Promise = require('bluebird');
const { expect } = require('chai');
const { times, noop } = require('lodash');
const { startService, clearRedis } = require('../../config');

describe('#login-rate-limits', function loginSuite() {
  const user = { username: 'v@makeomatic.ru', password: 'nicepassword', audience: '*.localhost' };
  const userWithValidPassword = { ...user, password: 'nicepassword1' };

  describe('positive interval', () => {
    before(() => startService.call(this, {
      rateLimiters: {
        userLogin: {
          limitIp: {
            windowInterval: 1000 * 60 * 60 * 24, // 24 hours
            windowLimit: 15,
            blockInterval: 1000 * 60 * 60 * 24 * 7, // 7 days
          },
          limitUserIp: {
            windowInterval: 1000 * 60 * 60 * 24, // 24 hours
            windowLimit: 5,
            blockInterval: 1000 * 60 * 60 * 24, // 1 day
          },
        },
      },
    }));

    after(clearRedis.bind(this));
    beforeEach(() => clearRedis.call(this, true));
    beforeEach(() => this.users.dispatch('register', { params: userWithValidPassword }));

    it('must lock ip for login completely after 15 attempts', async () => {
      const userWithRemoteIP = { remoteip: '10.0.0.1', ...user, username: 'doesnt_exist' };
      const promises = [];
      const eMsg = 'You are locked from making login attempts for 7 days from ipaddress \'10.0.0.1\'';

      times(16, () => {
        promises.push((
          this.users.dispatch('login', { params: { ...userWithRemoteIP } }).catch((e) => e)
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
          assert.rejects(this.users
            .dispatch('login', { params: { ...userWithRemoteIP } }), {
            name: 'HttpStatusError',
            statusCode: 403,
          })
        ));
      });

      await Promise.all(promises);

      await assert.rejects(this.users
        .dispatch('login', { params: { ...userWithRemoteIP } }), {
        name: 'HttpStatusError',
        statusCode: 429,
        message: eMsg,
      });
    });

    it('resets attempts for user after final success login', async () => {
      const userWithRemoteIP = { remoteip: '10.0.0.1', ...user };
      const userWithIPAndValidPassword = { ...userWithRemoteIP, ...userWithValidPassword };

      const promises = [];

      times(2, () => {
        promises.push(
          this.users.dispatch('login', { params: { ...userWithRemoteIP, username: 'notme' } }).catch(noop)
        );
      });

      times(3, () => {
        promises.push(
          this.users.dispatch('login', { params: { ...userWithRemoteIP } }).catch(noop)
        );
      });

      await Promise.all(promises);
      await this.users.dispatch('login', { params: userWithIPAndValidPassword });

      strictEqual(await this.users.redis.zrange('gl!ip!ctr!10.0.0.1', 0, -1).get('length'), 2);
    });
  });

  describe('ip rate limiter enabled block forever', () => {
    before(() => startService.call(this, {
      rateLimiters: {
        userLogin: {
          enabled: true,
          limitIp: {
            windowInterval: 0,
            windowLimit: 15,
            blockInterval: 0,
          },
          limitUserIp: {
            windowInterval: 0,
            windowLimit: 5,
            blockInterval: 0,
          },
        },
      },
    }));
    beforeEach(() => this.users.dispatch('register', { params: userWithValidPassword }));
    after(clearRedis.bind(this));
    afterEach(clearRedis.bind(this, true));

    it('must lock ip for login completely after 15 attempts', async () => {
      const userWithRemoteIP = { remoteip: '10.0.0.1', ...user, username: 'doesnt_exist' };
      const promises = [];
      const eMsg = 'You are locked from making login attempts forever from ipaddress \'10.0.0.1\'';

      times(16, () => {
        promises.push((
          this.users
            .dispatch('login', { params: { ...userWithRemoteIP } }).catch((e) => e)
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
          assert.rejects(this.users
            .dispatch('login', { params: { ...userWithRemoteIP } }), {
            name: 'HttpStatusError',
            statusCode: 403,
          })
        ));
      });

      await Promise.all(promises);

      await assert.rejects(this.users
        .dispatch('login', { params: { ...userWithRemoteIP } }), {
        name: 'HttpStatusError',
        statusCode: 429,
        message: eMsg,
      });

      return Promise.all(promises);
    });
  });
});
