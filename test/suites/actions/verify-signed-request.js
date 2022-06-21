const { strict: assert } = require('assert');
const { RequestLike, signRequest } = require('../utils/sign-request');

describe('#verify', function verifySuite() {
  before(global.startService);
  after(global.clearRedis);

  it('should validate params', async function test() {
    await assert.rejects(
      this.users.dispatch('verify-request-signature', { params: {} }),
      /data must have required property 'request', data must have required property 'audience'/
    );

    await assert.rejects(
      this.users.dispatch('verify-request-signature', { params: { request: {}, audience: {} } }),
      // eslint-disable-next-line max-len
      /data\/request must have required property 'url', data\/request must have required property 'method', data\/request must have required property 'headers', data\/audience must be string, data\/audience must be array, data\/audience must match exactly one schema in oneOf/
    );
  });

  it('should reject on invalid `Signature`', async function test() {
    await assert.rejects(
      this.users.dispatch('verify-request-signature', {
        params: {
          audience: 'some',
          request: {
            url: 'foo',
            method: 'get',
            headers: {
              authorization: 'Signature ddbb',
            },
          },
        },
      }),
      /invalid token/
    );
  });

  describe('valid-signature', function validSuite() {
    let token;
    let keyId;
    let nonSignToken;
    let nonSignKeyId;

    before(async function createToken() {
      await this.users.dispatch('register', {
        params: {
          username: 'v777@makeomatic.ru',
          password: '123',
          audience: 'test',
          metadata: {
            fine: true,
          },
        },
      });

      token = await this.users.dispatch('token.create', {
        params: {
          username: 'v777@makeomatic.ru',
          name: 'sample',
          type: 'sign',
          scopes: [{
            action: 'manage',
            subject: 'all',
          }],
        },
      });

      nonSignToken = await this.users.dispatch('token.create', {
        params: {
          username: 'v777@makeomatic.ru',
          name: 'sample-legacy',
        },
      });

      keyId = token.split('.').slice(0, 2).join('.');
      nonSignKeyId = token.split('.').slice(0, 2).join('.');
    });

    it('should not accept non sign token', async function test() {
      const req = new RequestLike({
        url: 'http://localhost:3000/foo/bar',
        method: 'get',
      });

      signRequest(req, {
        keyId: nonSignKeyId,
        key: nonSignToken,
        algorithm: 'hmac-sha512',
        ...this.users.config.auth.signedRequest,
      });

      const promise = this.users.dispatch('verify-request-signature', {
        params: {
          audience: this.users.config.jwt.defaultAudience,
          request: {
            headers: req.headers,
            url: req.path,
            method: 'get',
          },
        },
      });

      await assert.rejects(promise, /invalid token/);
    });

    it('should reject on not eisting token', async function test() {
      const req = new RequestLike({
        url: 'http://localhost:3000/foo/bar',
        method: 'get',
      });

      signRequest(req, {
        keyId: `${nonSignKeyId}x`,
        key: nonSignToken,
        algorithm: 'hmac-sha512',
        ...this.users.config.auth.signedRequest,
      });

      const promise = this.users.dispatch('verify-request-signature', {
        params: {
          audience: this.users.config.jwt.defaultAudience,
          request: {
            headers: req.headers,
            url: req.path,
            method: 'get',
          },
        },
      });

      await assert.rejects(promise, /invalid token/);
    });

    it('should not accept modified payload', async function test() {
      const json = { param: 'foo' };

      const req = new RequestLike({
        url: 'http://localhost:3000/foo/bar',
        method: 'post',
        json,
      });

      signRequest(req, {
        keyId,
        key: token,
        algorithm: 'hmac-sha512',
        ...this.users.config.auth.signedRequest,
      });

      const promise = this.users.dispatch('verify-request-signature', {
        params: {
          audience: this.users.config.jwt.defaultAudience,
          request: {
            headers: req.headers,
            url: req.path,
            method: 'post',
            params: {
              param: 'foO',
            },
          },
        },
      });

      await assert.rejects(promise, /invalid token/);
    });

    it('should accept valid signature and return user information + scopes', async function test() {
      const req = new RequestLike({
        url: 'http://localhost:3000/foo/bar',
        method: 'get',
      });

      signRequest(req, {
        keyId,
        key: token,
        algorithm: 'hmac-sha512',
        ...this.users.config.auth.signedRequest,
      });

      const res = await this.users.dispatch('verify-request-signature', {
        params: {
          audience: this.users.config.jwt.defaultAudience,
          request: {
            headers: req.headers,
            url: req.path,
            method: 'get',
          },
        },
      });

      assert.deepStrictEqual(res.scopes, [{ action: 'manage', subject: 'all' }]);
      assert.deepStrictEqual(res.metadata['*.localhost'].username, 'v777@makeomatic.ru');
      assert.ok(res.id);
      assert.deepStrictEqual(res.mfa, false);
    });

    it('should accept valid signature and return user information + scopes + post method', async function test() {
      const json = { param: 'foo' };

      const req = new RequestLike({
        url: 'http://localhost:3000/foo/bar',
        method: 'post',
        json,
      });

      signRequest(req, {
        keyId,
        key: token,
        algorithm: 'hmac-sha512',
        ...this.users.config.auth.signedRequest,
      });

      const res = await this.users.dispatch('verify-request-signature', {
        params: {
          audience: this.users.config.jwt.defaultAudience,
          request: {
            headers: req.headers,
            url: req.path,
            method: 'post',
            params: json,
          },
        },
      });

      assert.deepStrictEqual(res.scopes, [{ action: 'manage', subject: 'all' }]);
      assert.deepStrictEqual(res.metadata['*.localhost'].username, 'v777@makeomatic.ru');
      assert.ok(res.id);
      assert.deepStrictEqual(res.mfa, false);
    });

    it('should remap headers from `x-auth`', async function test() {
      const req = new RequestLike({
        url: 'http://localhost:3000/api/foo/bar',
        method: 'get',
      });

      signRequest(req, {
        keyId,
        key: token,
        algorithm: 'hmac-sha512',
        ...this.users.config.auth.signedRequest,
      });

      const res = await this.users.dispatch('verify-request-signature', {
        params: {
          audience: this.users.config.jwt.defaultAudience,
          request: {
            headers: {
              ...req.headers,
              'x-auth-url': '/api/foo/bar',
              'x-auth-method': 'get',
            },
            url: '/some/other-url',
            method: 'post',
          },
        },
      });

      assert.deepStrictEqual(res.scopes, [{ action: 'manage', subject: 'all' }]);
      assert.deepStrictEqual(res.metadata['*.localhost'].username, 'v777@makeomatic.ru');
      assert.ok(res.id);
      assert.deepStrictEqual(res.mfa, false);
    });
  });
});
