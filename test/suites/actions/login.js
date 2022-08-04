/* global startService, clearRedis */
const Promise = require('bluebird');
const { strict: assert } = require('assert');
const { omit } = require('lodash');
const sinon = require('sinon').usingPromise(Promise);

describe('#login', function loginSuite() {
  const user = { username: 'v@makeomatic.ru', password: 'nicepassword', audience: '*.localhost' };
  const userWithValidPassword = { username: 'v@makeomatic.ru', password: 'nicepassword1', audience: '*.localhost' };

  before(startService.bind(this));

  after(clearRedis.bind(this));
  afterEach(clearRedis.bind(this, true));

  it('must reject login on a non-existing username', async () => {
    await assert.rejects(this.users.dispatch('login', { params: user }), {
      name: 'HttpStatusError',
      statusCode: 404,
    });
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
      await assert.rejects(this.users.dispatch('login', { params: userWithValidPassword }), {
        name: 'HttpStatusError',
        statusCode: 412,
        reason: { username: userWithValidPassword.username },
      });
    });
  });

  describe('existing user: active', () => {
    beforeEach(async () => {
      await this.users
        .dispatch('register', { params: userWithValidPassword });
    });

    it('must reject login on an invalid password', async () => {
      await assert.rejects(this.users.dispatch('login', { params: user }), {
        name: 'HttpStatusError',
        statusCode: 403,
      });
    });

    describe('account: with alias', () => {
      const alias = 'bond';

      beforeEach(async () => {
        await this.users
          .dispatch('alias', { params: { username: userWithValidPassword.username, alias } });
      });

      it('allows to sign in with a valid alias', async () => {
        const reply = await this.users.dispatch('login', { params: { ...userWithValidPassword, username: alias } });
        await this.users.validator.validate('login.response', reply);
      });
    });

    describe('account: banned', () => {
      beforeEach(async () => {
        await this.users
          .dispatch('ban', { params: { username: user.username, ban: true } });
      });

      it('must reject login', async () => {
        await assert.rejects(this.users.dispatch('login', { params: userWithValidPassword }), {
          name: 'HttpStatusError',
          statusCode: 423,
        });
      });
    });

    it('must login on a valid account with correct credentials', async () => {
      const reply = await this.users.dispatch('login', { params: userWithValidPassword });
      await this.users.validator.validate('login.response', reply);
    });

    it('must login on a valid account without password with isSSO: true', async () => {
      const ssoUser = {
        ...omit(userWithValidPassword, ['password']),
        isSSO: true,
      };

      const reply = await this.users.dispatch('login', { params: ssoUser });
      await this.users.validator.validate('login.response', reply);
    });

    it('should reject signing in with bogus or expired disposable password', async () => {
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

      await this.users.dispatch('register', { params: opts });
      await assert.rejects(this.users.dispatch('login', { params }), {
        statusCode: 403,
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

      await this.users.validator.validate('login.response', response);

      assert.ok(response.jwt);
      assert.ok(response.user.id);
      assert.equal(response.user.metadata['*.localhost'].username, '79215555555');
    });
  });
});
