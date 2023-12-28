const Promise = require('bluebird');
const assert = require('node:assert/strict');
const request = require('request-promise').defaults({
  uri: 'https://ms-users.local/users/_/me',
  json: true,
  gzip: true,
  simple: true,
  strictSSL: false,
});
const { startService, clearRedis } = require('../../config');

describe('/_/me', function verifySuite() {
  beforeEach(startService);
  afterEach(clearRedis);

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
        authorization: 'JWT stop.not.working',
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

    await assert.rejects(request.get({
      headers: {
        authorization: 'JWT',
      },
    }), {
      error: {
        error: 'Unauthorized',
        message: 'An attempt was made to perform an operation without authentication: Token must be present',
        name: 'AuthenticationRequiredError',
        statusCode: 401,
      },
      statusCode: 401,
    });

    await assert.rejects(request.get({
      headers: {
        authorization: ' stop.not.working',
      },
    }), {
      error: {
        error: 'Unauthorized',
        message: 'An attempt was made to perform an operation without authentication: Token must be present',
        name: 'AuthenticationRequiredError',
        statusCode: 401,
      },
      statusCode: 401,
    });
  });

  it('must reject on an expired JWT token', async function test() {
    const { SignJWT } = require('jose');

    const {
      hashingFunction: algorithm, secret, issuer, defaultAudience,
    } = this.users.config.jwt;

    const token = await new SignJWT({ username: 'vitaly' })
      .setProtectedHeader({ alg: algorithm })
      .setAudience(defaultAudience)
      .setIssuer(issuer)
      .sign(Buffer.from(secret));

    await assert.rejects(request.get({
      headers: {
        authorization: `JWT ${token}`,
      },
    }), {
      error: {
        name: 'HttpStatusError',
        message: 'token has expired or was forged',
        error: 'Forbidden',
        statusCode: 403,
      },
      statusCode: 403,
    });
  });

  describe('valid token', function suite() {
    const jwt = require('../../../src/utils/jwt');
    let bearerAuthHeaders;
    let jwtAuthHeaders;

    const verifyBody = (body) => {
      assert.ok(body.id);
      assert.equal(body.metadata['*.localhost'].username, 'v@makeomatic.ru');
      assert.deepEqual(body.metadata.test, { fine: true });
    };

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
      jwtAuthHeaders = { authorization: `JWT ${jwtTokenData.jwt}` };
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
