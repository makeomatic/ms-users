const Promise = require('bluebird');
const { inspectPromise } = require('@makeomatic/deploy');
const { expect } = require('chai');
const assert = require('assert');
const sinon = require('sinon').usingPromise(Promise);
const redisKey = require('../../../src/utils/key');

describe('#requestPassword', function requestPasswordSuite() {
  const username = 'v@makeomatic.ru';
  const audience = 'requestPassword';
  const { USERS_BANNED_FLAG, USERS_ACTIVE_FLAG, USERS_DATA } = require('../../../src/constants.js');

  let userId;

  beforeEach(global.startService.bind(this));
  afterEach(global.clearRedis.bind(this));

  beforeEach(async () => {
    const { user } = await this.dispatch('users.register', {
      username,
      password: '123',
      audience,
      metadata: {
        rpass: true,
      },
    });

    userId = user.id;
  });

  it('must fail when user does not exist', async () => {
    const requestPassword = await this
      .dispatch('users.requestPassword', { username: 'noob' })
      .reflect()
      .then(inspectPromise(false));

    expect(requestPassword.name).to.be.eq('HttpStatusError');
    expect(requestPassword.statusCode).to.be.eq(404);
  });

  describe('account: inactive', () => {
    beforeEach(() => {
      return this.users.redis.hset(redisKey(userId, USERS_DATA), USERS_ACTIVE_FLAG, 'false');
    });

    it('must fail when account is inactive', async () => {
      const requestPassword = await this.dispatch('users.requestPassword', { username })
        .reflect()
        .then(inspectPromise(false));

      expect(requestPassword.name).to.be.eq('HttpStatusError');
      expect(requestPassword.statusCode).to.be.eq(412);
    });
  });

  describe('account: banned', () => {
    beforeEach(() => {
      return this.users.redis.hset(redisKey(userId, USERS_DATA), USERS_BANNED_FLAG, 'true');
    });

    it('must fail when account is banned', async () => {
      const requestPassword = await this.dispatch('users.requestPassword', { username })
        .reflect()
        .then(inspectPromise(false));

      expect(requestPassword.name).to.be.eq('HttpStatusError');
      expect(requestPassword.statusCode).to.be.eq(423);
    });
  });

  describe('account: active', () => {
    it('must send challenge email for an existing user with an active account', async () => {
      const requestPassword = await this.dispatch('users.requestPassword', { username });
      expect(requestPassword).to.be.deep.eq({ success: true });
    });

    it('must send challenge sms for an existing user with an active account', async () => {
      const amqpStub = sinon.stub(this.users.amqp, 'publishAndWait');
      const phoneUsername = '79215555555';
      const registerParams = {
        username: phoneUsername,
        password: '123',
        challengeType: 'phone',
        audience,
        metadata: {
          rpass: true,
        },
      };
      const requestPasswordParams = { username: phoneUsername, challengeType: 'phone', wait: true };

      amqpStub.withArgs('phone.message.predefined')
        .resolves({ queued: true });

      await this.dispatch('users.register', registerParams);
      const requestPassword = await this.dispatch('users.requestPassword', requestPasswordParams);

      assert.equal(amqpStub.args.length, 1);

      const args = amqpStub.args[0];
      const action = args[0];
      const message = args[1];

      assert.equal(action, 'phone.message.predefined');
      assert.equal(message.account, 'twilio');
      assert.equal(/\d{4} is your code for reset password/.test(message.message), true);
      assert.equal(message.to, '+79215555555');
      assert.deepEqual(requestPassword, { success: true });

      amqpStub.restore();
    });

    it('must reject sending reset password emails for an existing user more than once in 3 hours', async () => {
      await this.dispatch('users.requestPassword', { username });
      const requestPassword = await this.dispatch('users.requestPassword', { username })
        .reflect()
        .then(inspectPromise(false));

      expect(requestPassword.name).to.be.eq('HttpStatusError');
      expect(requestPassword.statusCode).to.be.eq(429);
    });
  });
});
