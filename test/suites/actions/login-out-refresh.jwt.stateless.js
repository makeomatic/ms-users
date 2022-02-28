const assert = require('assert');
const { delay } = require('bluebird');
const { decodeAndVerify } = require('../../../src/utils/jwt');
const { USERS_ADMIN_ROLE } = require('../../../src/constants');

describe('#stateless-jwt', function loginSuite() {
  const user = { username: 'v@makeomatic.ru', password: 'nicepassword', audience: '*.localhost' };
  let count = 1;
  let userId;
  let lastUsername;

  beforeEach(async () => {
    count += 1;
    lastUsername = `${user.username}.${count}`;
    ({ user: { id: userId } } = await this.users.dispatch('register', {
      params: {
        ...user,
        username: lastUsername,
        metadata: {
          roles: [USERS_ADMIN_ROLE],
        },
      },
    }));
  });

  const loginUser = async (isStatelessAuth = true) => {
    return this.users.dispatch('login', { params: { isStatelessAuth, ...user, username: lastUsername } });
  };

  const getRules = async (username) => {
    return this.users.dispatch('revoke-rule.list', { params: { username } });
  };

  describe('Smoke On Stateless disabled', () => {
    before('start', async () => {
      await global.startService.call(this, {
        jwt: {
          stateless: {
            enabled: false,
            force: true,
          },
        },
      });
    });

    after('stop', async () => {
      await global.clearRedis.call(this, false);
    });

    it('refresh should panic when stateless disabled', async () => {
      const { jwt } = await loginUser(false);

      await assert.rejects(
        this.users.dispatch('refresh', { params: { token: jwt, audience: user.audience } }),
        /`Stateless JWT` should be enabled/
      );
    });

    it('login should panic when stateless disabled and stateless requested', async () => {
      await assert.rejects(
        loginUser(true),
        /`Stateless JWT` should be enabled/
      );
    });
  });

  describe('Generic', () => {
    before('start', async () => {
      await global.startService.call(this, {
        jwt: {
          stateless: {
            enabled: true,
            force: true,
          },
        },
      });

      await delay(100);
    });

    after('stop', async () => {
      await global.clearRedis.call(this, false);
    });

    it('should return 2 keys on login', async () => {
      const response = await loginUser();

      assert.ok(response.jwt);
      assert.ok(response.jwtRefresh, 'should provide refresh token');
    });

    it('should return 2 keys on login when forced and isStatelessAuth is false', async () => {
      const response = await loginUser(false);

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

      const oldTokenDecoded = await decodeAndVerify(this.users, oldJwt, user.audience);
      const newTokenDecoded = await decodeAndVerify(this.users, response.jwt, user.audience);
      const refreshTokenDecoded = await decodeAndVerify(this.users, jwtRefresh, user.audience);

      assert.deepStrictEqual(oldTokenDecoded.metadata, { rules: [USERS_ADMIN_ROLE] });
      assert.deepStrictEqual(newTokenDecoded.metadata, { rules: [USERS_ADMIN_ROLE] });

      const rules = await getRules(userId);

      assert.strictEqual(rules.length, 1);

      assert.strictEqual(rules[0].rule.rt, oldTokenDecoded.rt);
      assert.deepStrictEqual(rules[0].rule.iat, { lt: newTokenDecoded.iat });
      assert.strictEqual(rules[0].params.ttl, refreshTokenDecoded.exp);
      assert.deepStrictEqual(oldTokenDecoded.audience, newTokenDecoded.audience);

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
      const refreshTokenDecoded = await decodeAndVerify(this.users, jwtRefresh, '*.localhost');

      const rules = await getRules(userId);

      assert.strictEqual(rules[0].rule.cs, refreshTokenDecoded.cs);
      assert.strictEqual(rules[0].rule.rt, refreshTokenDecoded.cs);
      assert.strictEqual(rules[0].params.ttl, refreshTokenDecoded.exp);
      assert.ok(rules[0].rule._or);

      // try again with same access token
      await assert.rejects(
        this.users.dispatch('verify', { params: { token: jwt, audience: user.audience } }),
        /invalid token/
      );
    });

    it('#GLOBAL should invalidate all tokens', async () => {
      const { jwtRefresh, jwt } = await loginUser();

      await this.users.dispatch('revoke-rule.add', {
        params: {
          rule: {
            iat: { lte: Date.now() },
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

    it('should return 2 keys on login', async () => {
      const response = await loginUser();
      assert.ok(response.jwt);
      assert.ok(response.jwtRefresh, 'should provide refresh token');
    });
  });

  describe('Refresh token rotation', () => {
    describe('`refresh` always', () => {
      before('start', async () => {
        await global.startService.call(this, {
          jwt: {
            stateless: {
              enabled: true,
              force: true,
              refreshRotation: {
                enabled: true,
                always: true,
              },
            },
          },
        });

        await delay(100);
      });

      after('stop', async () => {
        await global.clearRedis.call(this, false);
      });

      it('test', async () => {
        const { jwt: oldJwt, jwtRefresh } = await loginUser();

        const response = await this.users.dispatch('refresh', { params: { token: jwtRefresh, audience: user.audience } });

        assert.ok(response.jwt);
        assert.ok(response.jwtRefresh, 'should provide refresh token');
        assert.ok(response.jwtRefresh !== jwtRefresh, 'should return different refresh jwt token');

        const oldTokenDecoded = await decodeAndVerify(this.users, oldJwt, user.audience);
        const newTokenDecoded = await decodeAndVerify(this.users, response.jwt, user.audience);
        const refreshTokenDecoded = await decodeAndVerify(this.users, jwtRefresh, user.audience);

        const rules = await getRules(userId);

        assert.strictEqual(rules.length, 1);

        assert.deepStrictEqual(rules[0].rule, {
          _or: true,
          cs: refreshTokenDecoded.cs,
          rt: refreshTokenDecoded.cs,
        });

        assert.deepStrictEqual(oldTokenDecoded.audience, newTokenDecoded.audience);
      });
    });

    describe('interval refresh', () => {
      before('start', async () => {
        await global.startService.call(this, {
          jwt: {
            stateless: {
              enabled: true,
              force: true,
              refreshRotation: {
                enabled: true,
                interval: 1 * 1000, // 1 second
              },
            },
          },
        });

        await delay(100);
      });

      after('stop', async () => {
        await global.clearRedis.call(this, false);
      });

      it('test before interval', async () => {
        const { jwtRefresh } = await loginUser();

        const response = await this.users.dispatch('refresh', { params: { token: jwtRefresh, audience: user.audience } });
        assert.ok(response.jwt);
        assert.ok(response.jwtRefresh, 'should provide refresh token');
        assert.ok(response.jwtRefresh === jwtRefresh, 'should return same refresh jwt token');
      });

      it('test after interval', async () => {
        const { jwtRefresh } = await loginUser();
        await delay(1000); // to reach interval

        const response = await this.users.dispatch('refresh', { params: { token: jwtRefresh, audience: user.audience } });
        assert.ok(response.jwt);
        assert.ok(response.jwtRefresh, 'should provide refresh token');
        assert.ok(response.jwtRefresh === jwtRefresh, 'should return same refresh jwt token');
      });
    });
  });

  describe('Compat', () => {
    before('start', async () => {
      await global.startService.call(this, {
        jwt: {
          stateless: {
            enabled: true,
            force: false,
          },
        },
      });

      await delay(100);
    });

    after('stop', async () => {
      await global.clearRedis.call(this, false);
    });

    it('should return 1 key on login if isStatefullAuth not passed', async () => {
      const response = await loginUser(false);

      assert.ok(response.jwt);
      assert.ok(!response.jwtRefresh, 'should not return refresh token');
    });

    it('#verify should verify legacy token', async () => {
      const { jwt } = await loginUser(false);
      const response = await this.users.dispatch('verify', { params: { token: jwt, audience: user.audience } });
      assert.ok(response.id);
      assert.ok(response.metadata);
    });

    it('#logout should accept refresh token', async () => {
      const { jwt } = await loginUser(false);
      const now = Date.now();

      await this.users.dispatch('logout', { params: { jwt, audience: user.audience } });
      const accessTokenDecoded = await decodeAndVerify(this.users, jwt, '*.localhost');

      const rules = await getRules(userId);

      assert.strictEqual(rules[0].rule.cs, accessTokenDecoded.cs);
      assert.strictEqual(rules[0].rule.rt, accessTokenDecoded.cs);
      assert.ok(rules[0].rule._or);
      assert.ok(rules[0].params.ttl - now >= this.users.config.jwt.ttl);

      // try again with same access token
      await assert.rejects(
        this.users.dispatch('verify', { params: { token: jwt, audience: user.audience } }),
        /token has expired or was forged/
      );
    });
  });
});
