const assert = require('assert');
const { delay } = require('bluebird');

describe('#stateless-jwt', function loginSuite() {
  const user = { username: 'v@makeomatic.ru', password: 'nicepassword', audience: '*.localhost' };
  let count = 1;
  let userId;
  let lastUsername;

  before('start', async () => {
    await global.startService.call(this, {
      revocationRulesManager: { enabled: true, jobsEnabled: false },
      revocationRulesStorage: { syncEnabled: true },
    });

    await this.users.revocationRulesManager.batchDelete(['']);
    await delay(100);
  });

  beforeEach(async () => {
    count += 1;
    lastUsername = `${user.username}.${count}`;
    ({ user: { id: userId } } = await this.users.dispatch('register', {
      params: {
        ...user, username: lastUsername,
      },
    }));
  });

  after('stop', async () => {
    await global.clearRedis.call(this, false);
  });

  const loginUser = async () => {
    return this.users.dispatch('login', { params: { isStatelessAuth: true, ...user, username: lastUsername } });
  };

  const getRules = async (username) => {
    return this.users.dispatch('revoke-rule.list', { params: { username } });
  };

  it('should return 2 keys on login', async () => {
    const response = await loginUser();

    assert.ok(response.jwt);
    assert.ok(response.jwtRefresh, 'should provide refresh token');
  });

  it('#verify should verify access token', async () => {
    const { jwt } = await loginUser();
    const response = await this.users.dispatch('verify', { params: { token: jwt, audience: user.audience } });
    assert.ok(response.id);
    assert.ok(response.metadata);
  });

  it('#verify should not accept refresh token', async () => {
    const { jwtRefresh } = await loginUser();
    await assert.rejects(
      this.users.dispatch('verify', { params: { token: jwtRefresh, audience: user.audience } }),
      /access token required/
    );
  });

  it('#refresh should accept refresh token', async () => {
    const { jwt: oldJwt, jwtRefresh } = await loginUser();

    const response = await this.users.dispatch('refresh', { params: { token: jwtRefresh, audience: user.audience } });

    assert.ok(response.jwt);
    assert.ok(response.jwtRefresh, 'should provide refresh token');
    assert.strictEqual(response.jwtRefresh, jwtRefresh, 'should return same refresh jwt token');

    const rules = await getRules(userId);

    assert.strictEqual(rules.length, 1);
    assert.ok(rules[0].params.rt);
    assert.ok(rules[0].params.iat);
    assert.ok(rules[0].params.ttl);

    await delay(100);

    // try again with same access token
    await assert.rejects(
      this.users.dispatch('verify', { params: { token: oldJwt, audience: user.audience } }),
      /invalid token/
    );
  });

  it('#refresh should not accept access token', async () => {
    const { jwt } = await loginUser();

    await assert.rejects(
      this.users.dispatch('refresh', { params: { token: jwt, audience: user.audience } }),
      /refresh token required/
    );
  });

  it('#logout should not accept access token', async () => {
    const { jwt } = await loginUser();

    await assert.rejects(
      this.users.dispatch('logout', { params: { jwt, audience: user.audience } }),
      /refresh token required/
    );
  });

  it('#logout should accept refresh token', async () => {
    const { jwtRefresh, jwt } = await loginUser();

    await this.users.dispatch('logout', { params: { jwt: jwtRefresh, audience: user.audience } });

    const rules = await getRules(userId);

    assert.ok(rules[0].params.cs);
    assert.ok(rules[0].params.rt);
    assert.ok(rules[0].params._or);
    assert.strictEqual(rules[0].params.cs, rules[0].params.rt);
    assert.ok(rules[0].params.ttl);

    // try again with same access token
    await assert.rejects(
      this.users.dispatch('verify', { params: { token: jwt, audience: user.audience } }),
      /invalid token/
    );
  });

  it('#GLOBAL should invalidate all tokens', async () => {
    const { jwtRefresh, jwt } = await loginUser();

    await this.users.dispatch('revoke-rule.update', {
      params: {
        rule: {
          params: {
            iat: { lte: Date.now() },
          },
        },
      },
    });

    await delay(100);

    await assert.rejects(
      this.users.dispatch('verify', { params: { token: jwt, audience: user.audience } }),
      /invalid token/
    );

    await assert.rejects(
      this.users.dispatch('refresh', { params: { token: jwtRefresh, audience: user.audience } }),
      /invalid token/
    );
  });
});
