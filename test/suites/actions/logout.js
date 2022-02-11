const { strict: assert } = require('assert');

describe('#logout', function logoutSuite() {
  const username = 'logout@me.com';

  before(global.startService);
  before('register user', global.globalRegisterUser(username));
  before('auth user', global.globalAuthUser(username));
  after(global.clearRedis);

  it('must reject logout on an invalid JWT token', async function test() {
    const { defaultAudience: audience } = this.users.config.jwt;

    await assert.rejects(this.users
      .dispatch('logout', { params: { jwt: 'tests', audience } }), {
      name: 'HttpStatusError',
      statusCode: 403,
    });
  });

  it('must delete JWT token from pool of valid tokens', async function test() {
    const audience = this.users.config.jwt.defaultAudience;
    const token = this.jwt;

    // verify that no error is thrown
    await this.users
      .dispatch('verify', { params: { token, audience } });

    // verify we can "invalidate" the token
    const logout = await this.users
      .dispatch('logout', { params: { jwt: token, audience } });

    assert.deepStrictEqual(logout, { success: true });

    await assert.rejects(this.users
      .dispatch('verify', { params: { token, audience } }), {
      name: 'HttpStatusError',
      statusCode: 403,
      message: 'token has expired or was forged',
    });
  });
});
