const assert = require('node:assert/strict');
const { jwtVerify, SignJWT } = require('jose');
const { startService, clearRedis } = require('../../config');

describe('#intercom', function intercomSuite() {
  const secret = 'test-secret-at-least-32-characters-long';
  const username = 'v@makeomatic.ru';
  const audience = '*.localhost';

  function register() {
    return this.users.dispatch('register', {
      params: {
        username,
        password: '123',
        audience,
        activate: true,
        skipChallenge: true,
      },
    });
  }

  describe('disabled', function disabledSuite() {
    beforeEach(function start() {
      return startService.call(this, { intercom: { enabled: false, secret } });
    });

    afterEach(clearRedis);

    it('must reject with 501 when intercom is disabled', async function test() {
      await register.call(this);

      await assert.rejects(this.users.dispatch('intercom', { params: { username } }), {
        name: 'HttpStatusError',
        statusCode: 501,
      });
    });
  });

  describe('enabled', function enabledSuite() {
    beforeEach(function start() {
      return startService.call(this, { intercom: { enabled: true, secret } });
    });

    afterEach(clearRedis);

    it('must reject on a non-existing username', async function test() {
      await assert.rejects(this.users.dispatch('intercom', { params: { username: 'noob' } }), {
        name: 'HttpStatusError',
        statusCode: 404,
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

      const { payload, protectedHeader } = await jwtVerify(token, Buffer.from(secret), { algorithms: ['HS256'] });

      assert.equal(protectedHeader.alg, 'HS256');
      assert.equal(payload.user_id, user.id);
      assert.equal(payload.email, username);
      assert.equal(payload.studio_help_center_access, true);
      assert.equal(payload.password, undefined);
      assert.ok(payload.exp);
      assert.equal(typeof expiresAt, 'number');
      assert.equal(expiresAt, payload.exp * 1000);
    });

    it('must not verify token signed with a different secret', async function test() {
      await register.call(this);
      const { token } = await this.users.dispatch('intercom', { params: { username } });

      await assert.rejects(jwtVerify(token, Buffer.from('another-secret-at-least-32-characters'), { algorithms: ['HS256'] }), {
        code: 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
      });

      const forged = await new SignJWT({ user_id: 'forged' })
        .setProtectedHeader({ alg: 'HS256' })
        .sign(Buffer.from('another-secret-at-least-32-characters'));

      await assert.rejects(jwtVerify(forged, Buffer.from(secret), { algorithms: ['HS256'] }), {
        code: 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
      });
    });
  });
});
