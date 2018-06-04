const { inspectPromise } = require('@makeomatic/deploy');
const assert = require('assert');

describe('#logout', function logoutSuite() {
  before(global.startService);
  before(global.globalRegisterUser);
  before(global.globalAuthUser);
  after(global.clearRedis);

  it('must reject logout on an invalid JWT token', async function test() {
    const { defaultAudience: audience } = this.users._config.jwt;

    const logout = await this.dispatch('users.logout', { jwt: 'tests', audience })
      .reflect()
      .then(inspectPromise(false));

    assert.equal(logout.name, 'HttpStatusError');
    assert.equal(logout.statusCode, 403);
  });

  it('must delete JWT token from pool of valid tokens', async function test() {
    const audience = this.users.config.jwt.defaultAudience;
    const token = this.jwt;

    // verify that no error is thrown
    await this.dispatch('users.verify', { token, audience })
      .reflect()
      .then(inspectPromise());

    // verify we can "invalidate" the token
    const logout = await this.dispatch('users.logout', { jwt: token, audience })
      .reflect()
      .then(inspectPromise());

    assert.deepStrictEqual(logout, { success: true });

    // verify we can't login again using same token
    const login = await this.dispatch('users.verify', { token, audience })
      .reflect()
      .then(inspectPromise(false));

    assert.equal(login.name, 'HttpStatusError');
    assert.equal(login.statusCode, 403);
    assert.ok(/invalud token/.test(login.message));
  });
});
