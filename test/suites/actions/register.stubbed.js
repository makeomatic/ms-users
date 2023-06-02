const Promise = require('bluebird');
const { strict: assert } = require('assert');
const is = require('is');
const sinon = require('sinon').usingPromise(Promise);
const { startService, clearRedis } = require('../../config');

describe('#register stubbed', function suite() {
  /**
   * Suite performing same checks but with different configuration contexts
   */
  const mustBeAbleToSendActivationCodeBySms = async () => {
    const amqpStub = sinon.stub(this.users.amqp, 'publishAndWait');
    const opts = {
      activate: false,
      audience: '*.localhost',
      challengeType: 'phone',
      password: 'mynicepassword7521',
      username: '79215555555',
    };

    amqpStub
      .withArgs('phone.message.predefined')
      .resolves({ queued: true });

    try {
      const value = await this
        .users
        .dispatch('register', { params: opts });

      assert.equal(amqpStub.args.length, 1);

      const args = amqpStub.args[0];
      const action = args[0];
      const message = args[1];

      assert.equal(action, 'phone.message.predefined');
      assert.equal(message.account, 'twilio');
      assert.equal(/\d{4} is your activation code/.test(message.message), true);
      assert.equal(message.to, '+79215555555');

      assert.ok(value.id);
      assert.equal(value.requiresActivation, true);
      assert.equal(is.string(value.uid), true);
    } finally {
      amqpStub.restore();
    }
  };

  const mustBeAbleToSendPasswordBySms = async () => {
    const amqpStub = sinon.stub(this.users.amqp, 'publishAndWait');
    const opts = {
      activate: true,
      audience: '*.localhost',
      challengeType: 'phone',
      username: '79215555555',
    };

    amqpStub
      .withArgs('phone.message.predefined')
      .resolves({ queued: true });

    try {
      const value = await this.users.dispatch('register', { params: opts });

      assert.equal(amqpStub.args.length, 1);

      const args = amqpStub.args[0];
      const action = args[0];
      const message = args[1];

      assert.equal(action, 'phone.message.predefined');
      assert.equal(message.account, 'twilio');
      assert.equal(/^.{10} is your password/.test(message.message), true);
      assert.equal(message.to, '+79215555555');

      assert.ok(value.user.id);
      assert.deepEqual(value.user.metadata['*.localhost'].username, '79215555555');
    } finally {
      amqpStub.restore();
    }
  };

  const shouldBeAbleToRegisterWithoutPassword = async () => {
    const amqpStub = sinon.stub(this.users.amqp, 'publishAndWait');
    const opts = {
      activate: false,
      audience: '*.localhost',
      challengeType: 'phone',
      username: '79215555555',
      skipPassword: true,
    };

    amqpStub.withArgs('phone.message.predefined')
      .resolves({ queued: true });

    await this.users.dispatch('register', { params: opts });

    const args = amqpStub.args[0][1];
    const code = args.message.match(/^(\d+)/)[0];
    amqpStub.restore();

    const response = await this.users.dispatch('activate', { params: { token: code, username: '79215555555' } });

    assert.equal(is.string(response.jwt), true);
    assert.ok(response.user.id);
    assert.deepEqual(response.user.metadata['*.localhost'].username, '79215555555');

    const lastResponse = await this.users.dispatch('getInternalData', { params: { username: '79215555555' } });
    assert.equal(is.undefined(lastResponse.password), true);
  };

  describe('#password validator disabled', () => {
    beforeEach(startService.bind(this));
    afterEach(clearRedis.bind(this));

    it('must be able to send activation code by sms', mustBeAbleToSendActivationCodeBySms);
    it('must be able to send password by sms', mustBeAbleToSendPasswordBySms);
    it('should be able to register without password', shouldBeAbleToRegisterWithoutPassword);
  });

  describe('#password validator enabled', () => {
    beforeEach(async () => {
      await startService.call(this, {
        passwordValidator: { enabled: true },
      });
    });
    afterEach(clearRedis.bind(this));

    it('must be able to send activation code by sms', mustBeAbleToSendActivationCodeBySms);
    it('must be able to send password by sms', mustBeAbleToSendPasswordBySms);
    it('should be able to register without password', shouldBeAbleToRegisterWithoutPassword);
  });
});
