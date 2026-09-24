const assert = require('node:assert/strict');
const { jwtVerify } = require('jose');
const { startService, clearRedis } = require('../../config');

describe('#intercom', function intercomSuite() {
  const secret = 'test-secret-at-least-32-characters-long';
  const username = 'v@makeomatic.ru';
  const audience = '*.localhost';

  function register(params = {}) {
    return this.users.dispatch('register', {
      params: {
        username,
        password: '123',
        audience,
        activate: true,
        skipChallenge: true,
        ...params,
      },
    });
  }

  function verify(token) {
    return jwtVerify(token, Buffer.from(secret), { algorithms: ['HS256'] });
  }

  describe('not configured', function notConfiguredSuite() {
    afterEach(clearRedis);

    const cases = {
      disabled: { enabled: false, secret },
      'secret is empty': { enabled: true, secret: '' },
      'secret is too short': { enabled: true, secret: 'short-secret' },
    };

    for (const [title, intercom] of Object.entries(cases)) {
      it(`must reject with 501 when ${title}`, async function test() {
        await startService.call(this, { intercom });
        await register.call(this);

        await assert.rejects(this.users.dispatch('intercom', { params: { username } }), {
          name: 'HttpStatusError',
          statusCode: 501,
        });
      });
    }
  });

  describe('enabled', function enabledSuite() {
    beforeEach(function start() {
      return startService.call(this, {
        intercom: {
          enabled: true,
          secret,
          attributes: { studio_help_center_access: true, user_id: 'forged', email: 'forged@example.com' },
        },
      });
    });

    afterEach(clearRedis);

    it('must reject on a non-existing username', async function test() {
      await assert.rejects(this.users.dispatch('intercom', { params: { username: 'noob@makeomatic.ru' } }), {
        name: 'HttpStatusError',
        statusCode: 404,
      });
    });

    it('must reject unknown params', async function test() {
      await assert.rejects(this.users.dispatch('intercom', { params: { username, audience } }), {
        name: 'HttpStatusError',
        statusCode: 400,
      });
    });

    it('must reject for a banned user', async function test() {
      await register.call(this);
      await this.users.dispatch('ban', { params: { username, ban: true } });

      await assert.rejects(this.users.dispatch('intercom', { params: { username } }), {
        name: 'HttpStatusError',
        statusCode: 423,
      });
    });

    it('must return signed token for an existing user', async function test() {
      const { user } = await register.call(this);
      const { token, expiresAt } = await this.users.dispatch('intercom', { params: { username } });

      const { payload, protectedHeader } = await verify(token);

      assert.equal(protectedHeader.alg, 'HS256');
      assert.equal(payload.user_id, user.id);
      assert.equal(payload.email, username);
      assert.equal(payload.studio_help_center_access, true);
      assert.equal(payload.name, undefined);
      assert.equal(payload.password, undefined);
      assert.equal(payload.exp - payload.iat, 3600);
      assert.equal(typeof expiresAt, 'number');
      assert.equal(expiresAt, payload.exp * 1000);
    });

    it('must include string name from metadata', async function test() {
      await register.call(this, { metadata: { name: 'Vitaly' } });
      const { token } = await this.users.dispatch('intercom', { params: { username } });
      const { payload } = await verify(token);

      assert.equal(payload.name, 'Vitaly');
    });

    it('must skip non-string name from metadata', async function test() {
      await register.call(this, { metadata: { name: { q: 'verynicedata' } } });
      const { token } = await this.users.dispatch('intercom', { params: { username } });
      const { payload } = await verify(token);

      assert.equal(payload.name, undefined);
    });

    it('must skip email claim when username is not an email', async function test() {
      const phone = '79991234567';
      const { user } = await register.call(this, { username: phone });
      const { token } = await this.users.dispatch('intercom', { params: { username: phone } });
      const { payload } = await verify(token);

      assert.equal(payload.user_id, user.id);
      assert.equal(payload.email, undefined);
    });

    it('must not verify token with a different secret', async function test() {
      await register.call(this);
      const { token } = await this.users.dispatch('intercom', { params: { username } });

      await assert.rejects(jwtVerify(token, Buffer.from('another-secret-at-least-32-characters'), { algorithms: ['HS256'] }), {
        code: 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
      });
    });
  });
});
