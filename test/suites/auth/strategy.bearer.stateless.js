const Promise = require('bluebird');
const { strict: assert } = require('assert');
const request = require('request-promise').defaults({
  uri: 'https://ms-users.local/users/_/me',
  json: true,
  gzip: true,
  simple: true,
  strictSSL: false,
});

describe('/_/me', function verifySuite() {
  before('start', async function setup() {
    await global.startService.call(this, {
      jwt: {
        stateless: {
          enabled: true,
          force: true,
        },
      },
    });
  });

  after('stop', async function teardown() {
    await global.clearRedis.call(this, false);
  });

  it('must reject on missing JWT token', async function test() {
    await assert.rejects(request.get(), {
      error: {
        name: 'HttpStatusError',
        message: 'Credentials Required',
        error: 'Unauthorized',
        statusCode: 401,
      },
      statusCode: 401,
    });
  });

  it('must reject on an invalid JWT token', async function test() {
    await assert.rejects(request.get({
      headers: {
        'x-tkn-valid': 0,
        'x-tkn-reason': 'E_TKN_INVALID',
        'x-tkn-stateless': 1,
      },
    }), {
      error: {
        name: 'HttpStatusError',
        message: 'invalid token',
        error: 'Forbidden',
        statusCode: 403,
      },
      statusCode: 403,
    });
  });

  it('must reject on an expired JWT token', async function test() {
    await assert.rejects(request.get({
      headers: {
        'x-tkn-valid': 0,
        'x-tkn-reason': 'E_TKN_EXPIRE',
        'x-tkn-stateless': 1,
      },
    }), {
      error: {
        name: 'HttpStatusError',
        message: 'expired token',
        error: 'Unauthorized',
        statusCode: 401,
      },
      statusCode: 401,
    });
  });

  describe('valid token', function suite() {
    const jwt = require('../../../src/utils/jwt');
    let bearerAuthHeaders;
    let jwtAuthHeaders;
    let jwtAccessToken;

    const verifyBody = (body) => {
      assert.ok(body.id);
      assert.equal(body.metadata['*.localhost'].username, 'v@makeomatic.ru');
      assert.deepEqual(body.metadata.test, { fine: true });
    };

    before(async function pretest() {
      const regResponse = await this.users.dispatch('register', {
        params: {
          username: 'v@makeomatic.ru',
          password: '123',
          audience: 'test',
          metadata: {
            fine: true,
          },
        },
      });

      const [bearer, jwtTokenData] = await Promise.all([
        this.users.dispatch('token.create', {
          params: {
            username: 'v@makeomatic.ru',
            name: 'sample',
          },
        }),
        jwt.login.call(this.users, 'v@makeomatic.ru', 'test'),
      ]);

      bearerAuthHeaders = { authorization: `Bearer ${bearer}` };

      const jwtBody = `{"username":"${regResponse.user.id}","aud":"test"}`;
      jwtAccessToken = jwtTokenData.jwt;
      jwtAuthHeaders = {
        'x-tkn-valid': 1,
        'x-tkn-reason': 'ok',
        'x-tkn-stateless': 1,
        'x-tkn-body': jwtBody,
      };
    });

    it('fallback to generic check on backend unavailable', async () => {
      const body = await request.get({
        headers: {
          'x-tkn-valid': 0,
          'x-tkn-reason': 'E_BACKEND_UNAVAIL',
          'x-tkn-stateless': 1,
          authorization: `JWT ${jwtAccessToken}`,
        },
        qs: {
          audience: 'test',
        },
      });

      verifyBody(body);
    });

    it('must return user object and required audiences information on a valid JWT token', async () => {
      const body = await request
        .get({ headers: jwtAuthHeaders, qs: { audience: 'test' } });

      verifyBody(body);
    });

    it('must return user object and required audiences information on a valid JWT token', async function test() {
      const body = await this.users
        .amqp.publishAndWait('users._.me', { audience: 'test' }, {
          headers: jwtAuthHeaders,
        });

      verifyBody(body);
    });

    it('must return user object and required audiences information on a valid Bearer token', async () => {
      const body = await request
        .get({ headers: bearerAuthHeaders, qs: { audience: 'test' } });

      verifyBody(body);
    });

    it('must return user object and required audiences information on a valid Bearer token', async function test() {
      const body = await this.users
        .amqp.publishAndWait('users._.me', { audience: 'test' }, {
          headers: bearerAuthHeaders,
        });

      verifyBody(body);
    });
  });
});
