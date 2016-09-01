const assert = require('assert');
const is = require('is');
const sinon = require('sinon');

describe('`regenerate-token` action', function regenerateTokenSuite() {
  beforeEach(global.startService);
  afterEach(global.clearRedis);

  describe('with challenge type equals `phone`', function phoneSuite() {
    it('should be able to regenerate activation token from uid', function test() {
      const amqpStub = sinon.stub(this.users.amqp, 'publishAndWait');
      const opts = {
        activate: false,
        audience: '*.localhost',
        challengeType: 'phone',
        password: 'mynicepassword',
        username: '79215555555',
      };

      amqpStub.withArgs('phone.message.predefined')
        .returns(Promise.resolve({ queued: true }));

      return this.dispatch('users.register', opts)
        .reflect()
        .then(inspectPromise())
        .then(response => {
          assert.equal(response.requiresActivation, true);
          assert.equal(is.string(response.uid), true);

          return this.dispatch('users.regenerate-token', {
            challengeType: 'phone',
            uid: response.uid
          });
        })
        .reflect()
        .then(inspectPromise())
        .then(response => {
          assert.equal(response.regenerated, true);
          assert.equal(amqpStub.args.length, 2);

          const args = amqpStub.args[1];
          const action = args[0];
          const message = args[1];

          assert.equal(action, 'phone.message.predefined');
          assert.equal(message.account, 'twilio');
          assert.equal(/\d{4} is your activation code/.test(message.message), true);
          assert.equal(message.to, '79215555555');

          amqpStub.restore();
        });
    });

    it('should be able to regenerate reset password token from id and action', function test() {
      const amqpStub = sinon.stub(this.users.amqp, 'publishAndWait');
      const username = '79215555555';
      const registerParams = {
        audience: '*.localhost',
        challengeType: 'phone',
        password: '123',
        username,
      };
      const requestPasswordParams = { username, challengeType: 'phone' };

      amqpStub.withArgs('phone.message.predefined')
        .returns(Promise.resolve({ queued: true }));

      return this.dispatch('users.register', registerParams)
        .then(() => this.dispatch('users.requestPassword', requestPasswordParams))
        .reflect()
        .then(inspectPromise())
        .then(response => {
          assert.deepEqual(response, { success: true });

          return this.dispatch('users.regenerate-token', {
            action: 'reset',
            challengeType: 'phone',
            id: '79215555555',
          });
        })
        .reflect()
        .then(inspectPromise())
        .then(response => {
          assert.equal(response.regenerated, true);
          assert.equal(amqpStub.args.length, 2);

          const args = amqpStub.args[1];
          const action = args[0];
          const message = args[1];

          assert.equal(action, 'phone.message.predefined');
          assert.equal(message.account, 'twilio');
          assert.equal(/\d{4} is your code for reset password/.test(message.message), true);
          assert.equal(message.to, '79215555555');

          amqpStub.restore();
        });
    });
  });

  describe('with challenge type equals `email`', function emailSuite() {
    it('should be able to regenerate invitation from uid', function test() {
      const mailerStub = sinon.stub(this.users.mailer, 'send');
      mailerStub.withArgs('support@example.com')
        .returns(Promise.resolve());

      return this.dispatch('users.invite', {
          email: 'foo@yandex.ru',
          ctx: {
            firstName: 'Alex',
            lastName: 'Bon',
          },
          metadata: {
            '*.localhost': { plan: 'premium' },
          },
        })
        .reflect()
        .then(inspectPromise())
        .then(response => {
          assert.ok(response.queued);
          assert.ok(mailerStub.args[0][1].html.includes(response.context.token.secret));

          return this.dispatch('users.regenerate-token', {
            challengeType: 'email',
            uid: response.context.token.uid,
          });
        })
        .reflect()
        .then(inspectPromise())
        .then(response => {
          assert.ok(response.regenerated);
          assert.ok(response.uid);

          return this.users.tokenManager.info({ uid: response.uid });
        })
        .then(token => {
          assert.ok(mailerStub.args[1][1].html.includes(token.secret));

          mailerStub.restore();
        });
    });
  });
});
