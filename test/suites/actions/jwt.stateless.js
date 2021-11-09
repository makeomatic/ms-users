/* global startService, clearRedis */

const assert = require('assert');

describe('#stateless-jwt login verify', function loginSuite() {
  const user = { username: 'v@makeomatic.ru', password: 'nicepassword', audience: '*.localhost' };
  let jwt;
  let jwtRefresh;

  before(() => startService.call(this, {
    jwt: {
      forceStateless: true,
    },
  }));

  after(clearRedis.bind(this));
  before(() => this.users.dispatch('register', { params: user }));

  // afterEach(() => clearRedis.call(this, true));

  it('should return 2 keys on login', async () => {
    const response = await this.users.dispatch('login', { params: { isStatelessAuth: true, ...user } });

    assert.ok(response.jwt);
    assert.ok(response.jwtRefresh, 'should provide refresh token');

    ({ jwt, jwtRefresh } = response);
  });

  it('#verify should verify access token', async () => {
    const response = await this.users.dispatch('verify', { params: { token: jwt, audience: user.audience } });
    console.debug(response);
  });

  it('#verify should not accept refresh token', async () => {
    await assert.rejects(
      this.users.dispatch('verify', { params: { token: jwtRefresh, audience: user.audience } }),
      /access token required/
    );
  });

  it('#refresh should accept refresh token', async () => {
    const response = await this.users.dispatch('refresh', { params: { token: jwtRefresh, audience: user.audience } });

    assert.ok(response.jwt);
    assert.ok(response.jwtRefresh, 'should provide refresh token');
    console.debug('refresh response', response);
    ({ jwt, jwtRefresh } = response);
  });

  it('#refresh should not accept access token', async () => {
    await assert.rejects(
      this.users.dispatch('refresh', { params: { token: jwt, audience: user.audience } }),
      /refresh token required/
    );
  });

  it('#logout should not accept access token', async () => {
    await assert.rejects(
      this.users.dispatch('logout', { params: { jwt, audience: user.audience } }),
      /refresh token required/
    );
  });

  it('#logout should accept refresh token', async () => {
    await this.users.dispatch('logout', { params: { jwt: jwtRefresh, audience: user.audience } });
  });
});
