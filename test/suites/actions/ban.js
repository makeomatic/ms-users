const { strict: assert } = require('assert');

describe('#ban', function banSuite() {
  const username = 'spa@aminev.me';
  const password = '123';
  const audience = '*.localhost';

  beforeEach(global.startService);
  afterEach(global.clearRedis);

  it('must reject banning a non-existing user', async function test() {
    await assert.rejects(this.users.dispatch('ban', { params: { username: 'doesntexist', ban: true } }), {
      name: 'HttpStatusError',
      statusCode: 404,
    });
  });

  describe('user: active', function suite() {
    beforeEach(function pretest() {
      return this.users.dispatch('register', { params: { username, password, audience } });
    });

    it('must reject (un)banning a user without action being implicitly set', async function test() {
      await assert.rejects(this.users.dispatch('ban', { params: { username } }), {
        name: 'HttpStatusError',
        statusCode: 400,
      });
    });

    it('must be able to ban an existing user', async function test() {
      const response = await this.users.dispatch('ban', { params: { username, ban: true } });

      assert.equal(response[0], 1);
      assert.equal(response[1], 'OK');
    });

    it('requesting metadata with a special flag verifies ban state and throws', async function test() {
      const msg = {
        username,
        audience,
        includingBanned: false,
      };

      // ban first
      await this.users.dispatch('ban', { params: { username, ban: true } });

      // throws
      await assert.rejects(this.users.dispatch('getMetadata', { params: msg }), {
        name: 'HttpStatusError',
        statusCode: 423,
      });

      // unban
      await this.users.dispatch('ban', { params: { username, ban: false } });

      // no longer throws
      await this.users.dispatch('getMetadata', { params: msg });
    });

    it('must be able to unban an existing user', async function test() {
      await this.users.dispatch('ban', { params: { username, ban: true } });
      const ban = await this.users.dispatch('ban', { params: { username, ban: false } });

      assert.equal(ban[0], 1);
      assert.equal(ban[1], 2);
    });
  });
});
