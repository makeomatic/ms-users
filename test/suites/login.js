/* global startService, clearRedis */
const { inspectPromise } = require('@makeomatic/deploy');
const Promise = require('bluebird');
const assert = require('assert');
const moment = require('moment');
const { expect } = require('chai');
const { omit, times } = require('lodash');
const sinon = require('sinon').usingPromise(Promise);

describe('#login', function loginSuite() {
  const user = { username: 'v@makeomatic.ru', password: 'nicepassword', audience: '*.localhost' };
  const userWithValidPassword = { username: 'v@makeomatic.ru', password: 'nicepassword1', audience: '*.localhost' };

  before(startService.bind(this));
  after(clearRedis.bind(this));
  afterEach(clearRedis.bind(this, true));

  it('must reject login on a non-existing username', async () => {
    const login = await this.users
      .dispatch('login', { params: user })
      .reflect()
      .then(inspectPromise(false));

    expect(login.name).to.be.eq('HttpStatusError');
    expect(login.statusCode).to.be.eq(404);
  });

  describe('existing user: inactivate', () => {
    beforeEach(async () => {
      await this.users.dispatch('register', {
        params: {
          ...userWithValidPassword,
          activate: false,
          skipChallenge: true,
        },
      });
    });

    it('must reject login on an inactive account', async () => {
      const login = await this.users
        .dispatch('login', { params: userWithValidPassword })
        .reflect()
        .then(inspectPromise(false));

      expect(login.name).to.be.eq('HttpStatusError');
      expect(login.statusCode).to.be.eq(412);
    });
  });

  describe('existing user: active', () => {
    beforeEach(async () => {
      await this.users
        .dispatch('register', { params: userWithValidPassword });
    });

    it('must reject login on an invalid password', async () => {
      const login = await this.users
        .dispatch('login', { params: user })
        .reflect()
        .then(inspectPromise(false));

      expect(login.name).to.be.eq('HttpStatusError');
      expect(login.statusCode).to.be.eq(403);
    });

    describe('account: with alias', () => {
      const alias = 'bond';

      beforeEach(async () => {
        await this.users
          .dispatch('alias', { params: { username: userWithValidPassword.username, alias } });
      });

      it('allows to sign in with a valid alias', () => {
        return this.users
          .dispatch('login', { params: { ...userWithValidPassword, username: alias } })
          .reflect()
          .then(inspectPromise());
      });
    });

    describe('account: banned', () => {
      beforeEach(async () => {
        await this.users
          .dispatch('ban', { params: { username: user.username, ban: true } });
      });

      it('must reject login', async () => {
        const login = await this.users
          .dispatch('login', { params: userWithValidPassword })
          .reflect()
          .then(inspectPromise(false));

        expect(login.name).to.be.eq('HttpStatusError');
        expect(login.statusCode).to.be.eq(423);
      });
    });

    it('must login on a valid account with correct credentials', () => {
      return this.users
        .dispatch('login', { params: userWithValidPassword })
        .reflect()
        .then(inspectPromise());
    });

    it('must login on a valid account without password with isSSO: true', () => {
      const ssoUser = {
        ...omit(userWithValidPassword, ['password']),
        isSSO: true,
      };

      return this.users
        .dispatch('login', { params: ssoUser })
        .reflect()
        .then(inspectPromise());
    });

    it('must lock account for authentication after 5 invalid login attemps', () => {
      const userWithRemoteIP = { remoteip: '10.0.0.1', ...user };
      const promises = [];
      const config = this.users.config.jwt;
      const duration = moment().add(config.keepLoginAttempts, 'seconds').toNow(true);
      const eMsg = `You are locked from making login attempts for the next ${duration} from ipaddress '${userWithRemoteIP.remoteip}'`;

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

    it('must lock ip for login completely after 15 attempts', async () => {
      const userWithRemoteIP = { remoteip: '10.0.0.1', ...user, username: 'doesnt_exist' };
      const promises = [];
      const config = this.users.config.jwt;
      const duration = moment().add(config.keepGlobalLoginAttempts, 'seconds').toNow(true);
      const eMsg = `You are locked from making login attempts for the next ${duration} from ipaddress '${userWithRemoteIP.remoteip}'`;

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

    it('should reject signing in with bogus or expired disposable password', () => {
      const params = {
        audience: '*.localhost',
        isDisposablePassword: true,
        password: '321333',
        username: '79215555555',
      };

      const opts = {
        activate: true,
        audience: '*.localhost',
        challengeType: 'phone',
        skipPassword: true,
        username: '79215555555',
      };

      return this.users
        .dispatch('register', { params: opts })
        .then(() => this.users.dispatch('login', { params }))
        .reflect()
        .then(inspectPromise(false))
        .then((error) => {
          assert.equal(error.statusCode, 403);
        });
    });

    it('should be able to login by disposable password', async () => {
      let params;
      let response;

      const amqpStub = sinon
        .stub(this.users.amqp, 'publishAndWait');

      const opts = {
        activate: true,
        audience: '*.localhost',
        challengeType: 'phone',
        skipPassword: true,
        username: '79215555555',
      };

      amqpStub
        .withArgs('phone.message.predefined')
        .resolves({ queued: true });

      await this.users.dispatch('register', { params: opts });

      params = {
        challengeType: 'phone',
        id: '79215555555',
      };

      response = await this.users.dispatch('disposable-password', { params });

      assert.ok(response.uid, true);
      const args = amqpStub.args[0][1];
      const code = args.message.match(/(\d{4})/)[0];
      amqpStub.restore();

      params = {
        audience: '*.localhost',
        isDisposablePassword: true,
        password: code,
        username: '79215555555',
      };

      response = await this.users.dispatch('login', { params });

      assert.ok(response.jwt);
      assert.ok(response.user.id);
      assert.equal(response.user.metadata['*.localhost'].username, '79215555555');
    });
  });
});
