/* global inspectPromise */
const Promise = require('bluebird');
const assert = require('assert');
const is = require('is');
const sinon = require('sinon');

describe('#register stubbed', function suite() {
  beforeEach(global.startService);
  afterEach(global.clearRedis);

  it('must be able to send activation code by sms', function test() {
    const amqpStub = sinon.stub(this.users.amqp, 'publishAndWait');
    const opts = {
      activate: false,
      audience: '*.localhost',
      challengeType: 'phone',
      password: 'mynicepassword',
      username: '+79215555555',
    };

    amqpStub.withArgs('phone.message.predefined')
      .returns(Promise.resolve({ queued: true }));

    return this.dispatch('users.register', opts)
      .reflect()
      .then(inspectPromise())
      .then(value => {
        assert.equal(amqpStub.args.length, 1);

        const args = amqpStub.args[0];
        const action = args[0];
        const message = args[1];

        assert.equal(action, 'phone.message.predefined');
        assert.equal(message.account, 'twilio');
        assert.equal(/\d{4} is your activation code/.test(message.message), true);
        assert.equal(message.to, '+79215555555');
        assert.equal(value.requiresActivation, true);
        assert.equal(is.string(value.uid), true);

        amqpStub.restore();
      });
  });

  it('must be able to send password by sms', function test() {
    const amqpStub = sinon.stub(this.users.amqp, 'publishAndWait');
    const opts = {
      activate: true,
      audience: '*.localhost',
      challengeType: 'phone',
      username: '+79215555555',
    };

    amqpStub.withArgs('phone.message.predefined')
      .returns(Promise.resolve({ queued: true }));

    return this.dispatch('users.register', opts)
      .reflect()
      .then(inspectPromise())
      .then(value => {
        assert.equal(amqpStub.args.length, 1);

        const args = amqpStub.args[0];
        const action = args[0];
        const message = args[1];

        assert.equal(action, 'phone.message.predefined');
        assert.equal(message.account, 'twilio');
        assert.equal(/^.{10} is your password/.test(message.message), true);
        assert.equal(message.to, '+79215555555');
        assert.deepEqual(value.user.username, '+79215555555');

        amqpStub.restore();
      });
  });

  it('should be able to register without password', function test() {
    const amqpStub = sinon.stub(this.users.amqp, 'publishAndWait');
    const opts = {
      activate: false,
      audience: '*.localhost',
      challengeType: 'phone',
      username: '+79215555555',
      skipPassword: true,
    };

    amqpStub.withArgs('phone.message.predefined')
      .returns(Promise.resolve({ queued: true }));

    return this.dispatch('users.register', opts)
      .reflect()
      .then(inspectPromise())
      .then(() => {
        const args = amqpStub.args[0][1];
        const code = args.message.match(/^(\d+)/)[0];

        amqpStub.restore();

        return this.dispatch('users.activate', { token: code, username: '+79215555555' });
      })
      .reflect()
      .then(inspectPromise())
      .then(response => {
        assert.equal(is.string(response.jwt), true);
        assert.equal(response.user.username, '+79215555555');

        return this.dispatch('users.getInternalData', { username: '+79215555555' });
      })
      .reflect()
      .then(inspectPromise())
      .then(response => {
        assert.equal(is.undefined(response.password), true);
      });
  });
});
