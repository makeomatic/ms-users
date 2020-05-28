const { expect } = require('chai');
const assert = require('assert');
const is = require('is');
const sinon = require('sinon');

describe('#activate', function activateSuite() {
  const email = 'spa@aminev.me';

  beforeEach(global.startService);
  afterEach(global.clearRedis);

  beforeEach(async function genToken() {
    const result = await this.users.tokenManager.create({
      id: email,
      action: 'activate',
    });

    this.token = result.secret;
  });

  it('must reject activation when challenge token is invalid', async function test() {
    const params = { token: 'useless-token' };
    await assert.rejects(this.dispatch('users.activate', params), (activation) => {
      expect(activation.message).to.match(/invalid token/);
      expect(activation.name).to.be.eq('HttpStatusError');
      expect(activation.statusCode).to.be.eq(403);
      return true;
    });
  });

  describe('activate existing user', function suite() {
    beforeEach(async function pretest() {
      const { user } = await this.dispatch('users.register', {
        username: email,
        password: '123',
        audience: 'ok',
        activate: true,
        metadata: {
          wolf: true,
        },
      });

      this.userId = user.id;
    });

    it('must reject activation when account is already activated', async function test() {
      const params = { token: this.token };
      await assert.rejects(this.dispatch('users.activate', params), (activation) => {
        expect(activation.name).to.be.eq('HttpStatusError');
        expect(activation.message).to.match(new RegExp(`Account ${this.userId} was already activated`));
        expect(activation.statusCode).to.be.eq(417);
        return true;
      });
    });

    it('must deactivate account', async function test() {
      const params = { username: email, audience: 'ok' };
      await this.dispatch('users.deactivate', params);
    });
  });

  describe('activate inactive user', function suite() {
    beforeEach(function pretest() {
      return this.dispatch('users.register', {
        username: email,
        password: '123',
        audience: 'ok',
        metadata: {
          wolf: true,
        },
        activate: false,
        skipChallenge: true,
      });
    });

    it('must reject deactivation when account is already deactivated', async function test() {
      const params = { username: email, audience: 'ok' };
      await assert.rejects(this.dispatch('users.deactivate', params), (activation) => {
        expect(activation.name).to.be.eq('HttpStatusError');
        expect(activation.message).to.match(new RegExp(`Account ${email} was already deactivated`));
        expect(activation.statusCode).to.be.eq(417);
        return true;
      });
    });

    it('must activate account when challenge token is correct and not expired', async function test() {
      await this.dispatch('users.activate', { token: this.token });
    });
  });

  describe('activate inactive existing user', function suite() {
    beforeEach(function pretest() {
      const params = {
        username: 'v@makeomatic.ru', password: '123', audience: 'ok', metadata: { wolf: true }, activate: false,
      };
      return this.dispatch('users.register', params);
    });

    it('must activate account when only username is specified as a service action', async function test() {
      await this.dispatch('users.activate', { username: 'v@makeomatic.ru' });
    });
  });

  it('must fail to activate account when only username is specified as a service action and the user does not exist', async function test() {
    await assert.rejects(this.dispatch('users.activate', { username: 'v@makeomatic.ru' }), (activation) => {
      expect(activation.name).to.be.eq('HttpStatusError');
      expect(activation.statusCode).to.be.eq(404);
      return true;
    });
  });

  it('should be able to activate an account by sms', async function test() {
    const opts = {
      activate: false,
      audience: '*.localhost',
      challengeType: 'phone',
      password: 'mynicepassword',
      username: '79215555555',
    };
    const amqpStub = sinon.stub(this.users.amqp, 'publishAndWait');

    amqpStub.withArgs('phone.message.predefined')
      .resolves({ queued: true });

    const value = await this.dispatch('users.register', opts);
    const { message } = amqpStub.args[0][1];
    const code = message.match(/^(\d{4}) is your activation code/)[1];
    const userId = value.id;

    amqpStub.restore();

    const response = await this.dispatch('users.activate', { token: code, username: '79215555555' });

    console.info('%j', response);

    assert.equal(is.string(response.jwt), true);
    assert.equal(response.user.id, userId);
    assert.ok(/^\d+$/.test(response.user.metadata[opts.audience].aa));
  });
});
