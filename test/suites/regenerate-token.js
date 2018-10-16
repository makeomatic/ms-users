const Promise = require('bluebird');
const assert = require('assert');
const is = require('is');
const sinon = require('sinon').usingPromise(Promise);

describe('`regenerate-token` action', function regenerateTokenSuite() {
  beforeEach(global.startService.bind(this));
  afterEach(global.clearRedis.bind(this));

  describe('with challenge type equals `phone`', () => {
    it('should be able to regenerate activation token from uid', async () => {
      const amqpStub = sinon.stub(this.users.amqp, 'publishAndWait');
      const opts = {
        activate: false,
        audience: '*.localhost',
        challengeType: 'phone',
        password: 'mynicepassword',
        username: '79215555555',
      };

      amqpStub.withArgs('phone.message.predefined')
        .resolves({ queued: true });

      try {
        const resp1 = await this.dispatch('users.register', opts);

        assert.ok(resp1.id);
        assert.equal(resp1.requiresActivation, true);
        assert.equal(is.string(resp1.uid), true);

        const response = await this.dispatch('users.regenerate-token', {
          challengeType: 'phone',
          uid: resp1.uid,
        });

        assert.equal(response.regenerated, true);
        assert.equal(amqpStub.args.length, 2);

        const args = amqpStub.args[1];
        const action = args[0];
        const message = args[1];

        assert.equal(action, 'phone.message.predefined');
        assert.equal(message.account, 'twilio');
        assert.equal(/\d{4} is your activation code/.test(message.message), true);
        assert.equal(message.to, '+79215555555');
      } finally {
        amqpStub.restore();
      }
    });

    it('should be able to regenerate reset password token from id and action', async () => {
      const amqpStub = sinon.stub(this.users.amqp, 'publishAndWait');
      const username = '79215555555';
      const registerParams = {
        audience: '*.localhost',
        challengeType: 'phone',
        password: '123',
        username,
      };
      const requestPasswordParams = { username, challengeType: 'phone' };

      amqpStub
        .withArgs('phone.message.predefined')
        .resolves({ queued: true });

      try {
        await this.dispatch('users.register', registerParams);
        const resp1 = await this.dispatch('users.requestPassword', requestPasswordParams);

        assert.deepEqual(resp1, { success: true });

        const response = await this.dispatch('users.regenerate-token', {
          action: 'reset',
          challengeType: 'phone',
          id: '79215555555',
        });

        assert.equal(response.regenerated, true);
        assert.equal(amqpStub.args.length, 2);

        const args = amqpStub.args[1];
        const action = args[0];
        const message = args[1];

        assert.equal(action, 'phone.message.predefined');
        assert.equal(message.account, 'twilio');
        assert.equal(/\d{4} is your code for reset password/.test(message.message), true);
        assert.equal(message.to, '+79215555555');
      } finally {
        amqpStub.restore();
      }
    });
  });

  describe('with challenge type equals `email`', () => {
    it('should be able to regenerate invitation from uid', async () => {
      const mailerStub = sinon.stub(this.users.mailer, 'send');
      mailerStub.withArgs('support@example.com')
        .resolves();

      try {
        const resp1 = await this.dispatch('users.invite', {
          email: 'foo@yandex.ru',
          ctx: {
            firstName: 'Alex',
            lastName: 'Bon',
          },
          metadata: {
            '*.localhost': { plan: 'premium' },
          },
        });

        assert.ok(resp1.queued);
        assert.ok(mailerStub.args[0][1].html.includes(resp1.context.token.secret));

        const response = await this.dispatch('users.regenerate-token', {
          challengeType: 'email',
          uid: resp1.context.token.uid,
        });

        assert.ok(response.regenerated);
        assert.ok(response.uid);

        const token = await this.users.tokenManager.info({ uid: response.uid });
        assert.ok(mailerStub.args[1][1].html.includes(token.secret));
      } finally {
        mailerStub.restore();
      }
    });
  });
});
