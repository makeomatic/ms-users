const { expect } = require('chai');
const { strict: assert } = require('assert');
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
    await assert.rejects(this.users.dispatch('activate', { params }), (activation) => {
      expect(activation.message).to.match(/invalid token/);
      expect(activation.name).to.be.eq('HttpStatusError');
      expect(activation.statusCode).to.be.eq(403);
      return true;
    });
  });

  describe('activate existing user', function suite() {
    beforeEach(async function pretest() {
      const { user } = await this.users.dispatch('register', { params: {
        username: email,
        password: '123',
        audience: 'ok',
        activate: true,
        metadata: {
          wolf: true,
        },
      } });

      this.userId = user.id;
    });

    it('must reject activation when account is already activated', async function test() {
      const params = { token: this.token };
      await assert.rejects(this.users.dispatch('activate', { params }), (activation) => {
        expect(activation.name).to.be.eq('HttpStatusError');
        expect(activation.message).to.match(new RegExp(`Account ${this.userId} was already activated`));
        expect(activation.statusCode).to.be.eq(417);
        return true;
      });
    });

    it('must fail to activate already active user with both token and username provided', async function test() {
      await assert.rejects(this.users.dispatch('activate', { params: { token: this.token, username: email } }), (activation) => {
        expect(activation.name).to.be.eq('HttpStatusError');
        expect(activation.statusCode).to.be.eq(409);
        return true;
      });
    });
  });

  describe('activate inactive user', function suite() {
    beforeEach(function pretest() {
      return this.users.dispatch('register', { params: {
        username: email,
        password: '123',
        audience: 'ok',
        metadata: {
          wolf: true,
        },
        activate: false,
        skipChallenge: true,
      } });
    });

    it('must activate account when challenge token is correct and not expired', async function test() {
      await this.users.dispatch('activate', { params: { token: this.token } });
    });
  });

  describe('activate inactive existing user', function suite() {
    beforeEach(function pretest() {
      const params = {
        username: 'v@makeomatic.ru', password: '123', audience: 'ok', metadata: { wolf: true }, activate: false,
      };
      return this.users.dispatch('register', { params });
    });

    it('must activate account when only username is specified as a service action', async function test() {
      await this.users.dispatch('activate', { params: { username: 'v@makeomatic.ru' } });
    });
  });

  it('must fail to activate account when only username is specified as a service action and the user does not exist', async function test() {
    await assert.rejects(this.users.dispatch('activate', { params: { username: 'v@makeomatic.ru' } }), (activation) => {
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

    const value = await this.users.dispatch('register', { params: opts });
    const { message } = amqpStub.args[0][1];
    const code = message.match(/^(\d{4}) is your activation code/)[1];
    const userId = value.id;

    amqpStub.restore();

    const response = await this.users.dispatch('activate', { params: { token: code, username: '79215555555' } });

    assert.equal(is.string(response.jwt), true);
    assert.equal(response.user.id, userId);
    assert.ok(/^\d+$/.test(response.user.metadata[opts.audience].aa));
  });

  it('should verify contact too if shouldVerifyContact true', async function test() {
    const user = {
      username: 'v1@makeomatic.ru', password: '123', audience: 'ok', metadata: { wolf: true }, activate: false,
    };
    await this.users.dispatch('register', { params: user });

    const params = {
      username: user.username,
      contact: {
        value: user.username,
        type: 'email',
      },
    };

    await this.users.dispatch('contacts.add', { params });
    await this.users.dispatch('activate', { params: { username: user.username, shouldVerifyContact: true } });
    const { data } = await this.users.dispatch('contacts.list', { params: { username: user.username } });
    const firstContact = data.find((contact) => contact.value === params.contact.value);
    assert.strictEqual(firstContact.verified, true);
  });
});
