const Promise = require('bluebird');
const assert = require('assert');
const sinon = require('sinon');

describe('`disposable-password` action', function regenerateTokenSuite() {
  beforeEach(global.startService);
  afterEach(global.clearRedis);

  describe('with challenge type equals `phone`', function phoneSuite() {
    it('should be able to send disposable password', function test() {
      const amqpStub = sinon.stub(this.users.amqp, 'publishAndWait');
      const opts = {
        activate: true,
        audience: '*.localhost',
        challengeType: 'phone',
        skipPassword: true,
        username: '79215555555',
      };

      amqpStub.withArgs('phone.message.predefined')
        .returns(Promise.resolve({ queued: true }));

      const params = {
        challengeType: 'phone',
        id: '79215555555',
      };

      return this.dispatch('users.register', opts)
        .then(() =>
          this.dispatch('users.disposable-password', params)
        )
        .then(response => {
          assert.equal(response.requested, true);
          assert.ok(response.uid, true);
          assert.equal(amqpStub.args.length, 1);

          const args = amqpStub.args[0];
          const action = args[0];
          const message = args[1];

          assert.equal(action, 'phone.message.predefined');
          assert.equal(message.account, 'twilio');
          assert.equal(/\d{4} is your disposable password/.test(message.message), true);
          assert.equal(message.to, '+79215555555');

          amqpStub.restore();
        });
    });
  });
});
