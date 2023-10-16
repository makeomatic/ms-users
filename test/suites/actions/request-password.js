const Promise = require('bluebird');
const { expect } = require('chai');
const { strict: assert } = require('assert');
const sinon = require('sinon').usingPromise(Promise);
const redisKey = require('../../../src/utils/key');
const { startService, clearRedis } = require('../../config');

describe('#requestPassword', function requestPasswordSuite() {
  const username = 'v@makeomatic.ru';
  const audience = 'requestPassword';
  const { USERS_BANNED_FLAG, USERS_ACTIVE_FLAG, USERS_DATA } = require('../../../src/constants');

  let userId;

  beforeEach(startService.bind(this));
  afterEach(clearRedis.bind(this));

  beforeEach(async () => {
    const { user } = await this.users.dispatch('register', { params: {
      username,
      password: '123',
      audience,
      metadata: {
        rpass: true,
      },
    } });

    userId = user.id;
  });

  it('must fail when user does not exist', async () => {
    await assert.rejects(this.users.dispatch('requestPassword', { params: { username: 'noob' } }), {
      name: 'HttpStatusError',
      statusCode: 404,
      code: 'E_USER_ID_NOT_FOUND',
    });
  });

  describe('account: inactive', () => {
    beforeEach(() => {
      return this.users.redis.hset(redisKey(userId, USERS_DATA), USERS_ACTIVE_FLAG, 'false');
    });

    it('must fail when account is inactive', async () => {
      await assert.rejects(this.users.dispatch('requestPassword', { params: { username } }), {
        name: 'HttpStatusError',
        statusCode: 412,
      });
    });
  });

  describe('account: banned', () => {
    beforeEach(() => {
      return this.users.redis.hset(redisKey(userId, USERS_DATA), USERS_BANNED_FLAG, 'true');
    });

    it('must fail when account is banned', async () => {
      await assert.rejects(this.users.dispatch('requestPassword', { params: { username } }), {
        name: 'HttpStatusError',
        statusCode: 423,
      });
    });
  });

  describe('account: active', () => {
    it('must send challenge email for an existing user with an active account', async () => {
      const requestPassword = await this.users.dispatch('requestPassword', { params: { username } });
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

      await this.users.dispatch('register', { params: registerParams });
      const requestPassword = await this.users.dispatch('requestPassword', { params: requestPasswordParams });

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
      await this.users.dispatch('requestPassword', { params: { username } });
      await assert.rejects(this.users.dispatch('requestPassword', { params: { username } }), (e) => {
        return e.name === 'HttpStatusError'
          && e.statusCode === 429
          && e.reason
          && e.reason.ttl
          && e.reason.duration === 7200
          && e.reason.email === 'mailto@example.com';
      });
    });

    it('must generate password on request', async () => {
      const response = await this.users.dispatch('requestPassword', { params: { username, generateNewPassword: true } });
      assert.deepStrictEqual(response, { success: true });
    });
  });
});
