const { inspectPromise } = require('@makeomatic/deploy');
const assert = require('assert');

describe('#ban', function banSuite() {
  const username = 'spa@aminev.me';
  const password = '123';
  const audience = '*.localhost';

  beforeEach(global.startService);
  afterEach(global.clearRedis);

  it('must reject banning a non-existing user', async function test() {
    const error = await this.dispatch('users.ban', { username: 'doesntexist', ban: true })
      .reflect()
      .then(inspectPromise(false));

    assert.equal(error.name, 'HttpStatusError');
    assert.equal(error.statusCode, 404);
  });

  describe('user: active', function suite() {
    beforeEach(function pretest() {
      return this.dispatch('users.register', { username, password, audience });
    });

    it('must reject (un)banning a user without action being implicitly set', async function test() {
      const error = await this.dispatch('users.ban', { username })
        .reflect()
        .then(inspectPromise(false));

      assert.equal(error.name, 'HttpStatusError');
      assert.equal(error.statusCode, 400);
    });

    it('must be able to ban an existing user', async function test() {
      const response = await this.dispatch('users.ban', { username, ban: true });
      assert.equal(response[0], 1);
      assert.equal(response[2], 'OK');
    });

    it('requesting metadata with a special flag verifies ban state and throws', async function test() {
      const msg = {
        username,
        audience,
        includingBanned: false,
      };

      // ban first
      await this.dispatch('users.ban', { username, ban: true });

      // throws
      const error = await this.dispatch('users.getMetadata', msg)
        .reflect()
        .then(inspectPromise(false));

      assert.equal(error.name, 'HttpStatusError');
      assert.equal(error.statusCode, 423);

      // unban
      await this.dispatch('users.ban', { username, ban: false });

      // no longer throws
      await this.dispatch('users.getMetadata', msg);
    });

    it('must be able to unban an existing user', async function test() {
      await this.dispatch('users.ban', { username, ban: true });
      const ban = await this.dispatch('users.ban', { username, ban: false });

      assert.equal(ban[0], 1);
      assert.equal(ban[1], 2);
    });
  });
});
