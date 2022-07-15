const { strict: assert } = require('assert');
const { default: got } = require('got');

const { preRequest } = require('../utils/sign-request');

const req = got.extend({
  prefixUrl: 'https://ms-users.local/users',
  https: {
    rejectUnauthorized: false,
  },
  responseType: 'json',
  hooks: {
    beforeError: [
      (error) => {
        const { response } = error;
        if (response && response.body) {
          Object.assign(error, response.body);
          error.message = response.body.message;
        }

        return error;
      },
    ],
    beforeRequest: [preRequest],
  },
});

const signGetRequest = (url, extra, signature) => {
  return req.get(url, { ...extra, signature });
};

const signPostRequest = (url, extra, signature) => {
  return req.post(url, { ...extra, signature });
};

const verifyBody = (body) => {
  assert.ok(body.id);
  assert.equal(body.metadata['*.localhost'].username, 'v@makeomatic.ru');
  assert.deepEqual(body.metadata.test, { fine: true });
};

describe('/_/me', function verifySuite() {
  beforeEach(global.startService);
  afterEach(global.clearRedis);

  let bearerToken;
  let keyId;

  beforeEach(async function pretest() {
    await this.users.dispatch('register', {
      params: {
        username: 'v@makeomatic.ru',
        password: '123',
        audience: 'test',
        metadata: {
          fine: true,
        },
      },
    });

    bearerToken = await this.users.dispatch('token.create', {
      params: {
        username: 'v@makeomatic.ru',
        name: 'sample',
        type: 'sign',
      },
    });

    keyId = bearerToken.split('.').slice(0, 2).join('.');
  });

  it('invalid signature', async function test() {
    await assert.rejects(req.get('_/me', {
      headers: {
        authorization: 'Signature sskdd',
      },
    }), /invalid request signature/);
  });

  it('sign token denied when used as bearer', async function test() {
    await assert.rejects(req.get('_/me', {
      headers: {
        authorization: `Bearer ${bearerToken}`,
      },
    }), /invalid token/);
  });

  it('supports valid signature', async function test() {
    const res = await signGetRequest('_/me', { searchParams: { audience: 'test' } }, {
      keyId,
      key: bearerToken,
      algorithm: 'hmac-sha512',
    });

    verifyBody(res.body);
  });

  it('supports valid signature #post', async function test() {
    const promise = signPostRequest('_/me', {
      searchParams: { audience: 'test' },
      json: {
        data: {},
      },
    }, {
      keyId,
      key: bearerToken,
      algorithm: 'hmac-sha512',
    });

    // yes! validation error thrown because me action should not be used like this,
    // but this error shows that auth middleware worked and signature was valid
    await assert.rejects(promise, /me validation failed: data must NOT have additional properties/);
  });
});
