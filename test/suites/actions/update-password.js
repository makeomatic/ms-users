const { deepStrictEqual, strictEqual, strict: assert } = require('assert');
const { expect } = require('chai');

const redisKey = require('../../../src/utils/key');

describe('#updatePassword', function updatePasswordSuite() {
  const challenge = require('../../../src/utils/challenges/challenge');
  const { USERS_BANNED_FLAG, USERS_ACTIVE_FLAG, USERS_DATA } = require('../../../src/constants');

  const username = 'v@makeomatic.ru';
  const password = '123';
  const audience = '*.localhost';

  beforeEach(global.startService);
  afterEach(global.clearRedis);

  beforeEach(function pretest() {
    return this.users.dispatch('register', { params: { username, password, audience } })
      .then(({ user }) => { this.userId = user.id; });
  });

  it('must reject updating password for a non-existing user on username+password update', async function test() {
    const params = { username: 'mcdon@tour.de.france', currentPassword: 'xxx', newPassword: 'vvv' };

    await assert.rejects(this.users.dispatch('updatePassword', { params }), {
      name: 'HttpStatusError',
      statusCode: 404,
    });
  });

  describe('user: inactive', function suite() {
    beforeEach(function pretest() {
      return this.users.redis.hset(redisKey(this.userId, USERS_DATA), USERS_ACTIVE_FLAG, 'false');
    });

    it('must reject updating password for an inactive account on username+password update', async function test() {
      const params = { username, currentPassword: password, newPassword: 'vvv' };
      await assert.rejects(this.users.dispatch('updatePassword', { params }), {
        name: 'HttpStatusError',
        statusCode: 412,
      });
    });
  });

  describe('user: banned', function suite() {
    beforeEach(function pretest() {
      return this.users.redis.hset(redisKey(this.userId, USERS_DATA), USERS_BANNED_FLAG, 'true');
    });

    it('must reject updating password for an inactive account on username+password update', async function test() {
      const params = { username, currentPassword: password, newPassword: 'vvv' };
      await assert.rejects(this.users.dispatch('updatePassword', { params }), {
        name: 'HttpStatusError',
        statusCode: 423,
      });
    });
  });

  describe('user: active', function suite() {
    it('must reject updating password with an invalid username/password combination', async function test() {
      const params = { username, currentPassword: 'xxx', newPassword: 'vvv' };
      await assert.rejects(this.users.dispatch('updatePassword', { params }), {
        name: 'HttpStatusError',
        statusCode: 403,
      });
    });

    it('must update password with a valid username/password combination and different newPassword', async function test() {
      const params = { username, currentPassword: password, newPassword: 'vvv', remoteip: '10.0.0.0' };

      const reply = await this.users.dispatch('updatePassword', { params });
      await this.users.validator.validate('updatePassword.response', reply);
      expect(reply).to.be.deep.eq({ success: true });
    });

    describe('token', function tokenSuite() {
      beforeEach(function pretest() {
        return challenge
          .call(this.users, 'email', {
            id: username,
            action: 'reset',
          })
          .then((data) => {
            this.token = data.context.token.secret;
          });
      });

      it('must reject updating password for an invalid challenge token', async function test() {
        const params = { resetToken: 'wrong', newPassword: 'vvv' };
        await assert.rejects(this.users.dispatch('updatePassword', { params }), {
          name: 'HttpStatusError',
          statusCode: 403,
        });
      });

      it('must update password passed with a valid challenge token', async function test() {
        const { amqp, redis } = this.users;

        const result = await amqp.publishAndWait(
          'users.updatePassword',
          { resetToken: this.token, newPassword: 'vvv' }
        );
        const hashedPassword = await redis.hget(`${this.userId}!data`, 'password');

        await this.users.validator.validate('updatePassword.response', result);
        deepStrictEqual(result, { success: true });
        strictEqual(hashedPassword.startsWith('scrypt'), true);
        strictEqual(hashedPassword.length > 50, true);
      });

      it('must delete lock for ip after success update', async function test() {
        const { amqp, redis } = this.users;

        await redis.zadd(`${this.userId}!ip!10.0.0.1`, 1576335000001, 'token1');
        await redis.zadd(`${this.userId}!ip!10.0.0.1`, 1576335000002, 'token2');
        await redis.zadd('gl!ip!ctr!10.0.0.1', 1576335000001, 'token1');
        await redis.zadd('gl!ip!ctr!10.0.0.1', 1576335000002, 'token2');

        strictEqual(await redis.zrange(`${this.userId}!ip!10.0.0.1`, 0, -1).get('length'), 2);
        strictEqual(await redis.zrange('gl!ip!ctr!10.0.0.1', 0, -1).get('length'), 2);

        const result = await amqp.publishAndWait(
          'users.updatePassword',
          { resetToken: this.token, newPassword: 'vvv', remoteip: '10.0.0.1' }
        );

        await this.users.validator.validate('updatePassword.response', result);
        deepStrictEqual(result, { success: true });

        strictEqual(await redis.zrange(`${this.userId}!ip!10.0.0.1`, 0, -1).get('length'), 0);
        strictEqual(await redis.zrange('gl!ip!ctr!10.0.0.1', 0, -1).get('length'), 0);
      });
    });
  });
});
