/* global startService, clearRedis */
const { expect } = require('chai');
const { strict: assert } = require('assert');

describe('#verify', function verifySuite() {
  const ctx = {};

  before('test', async () => {
    ctx.service = await startService({
      jwt: {
        stateless: {
          fields: ['username', 'bogus'],
        },
      },
    });
  });
  afterEach(() => clearRedis());

  it('must reject on an invalid JWT token', async () => {
    const { defaultAudience: audience } = ctx.service.config.jwt;

    await assert.rejects(
      ctx.service.dispatch('verify', { params: { token: 'invalid-token', audience } }),
      {
        name: 'HttpStatusError',
        statusCode: 403,
        message: 'invalid token',
      }
    );
  });

  it('must reject on an expired JWT token', async () => {
    const { SignJWT } = require('jose');
    const {
      hashingFunction: algorithm, secret, issuer, defaultAudience,
    } = ctx.service.config.jwt;

    const token = await new SignJWT({ username: 'vitaly' })
      .setProtectedHeader({ alg: algorithm })
      .setAudience(defaultAudience)
      .setIssuer(issuer)
      .sign(Buffer.from(secret));

    await assert.rejects(
      ctx.service.dispatch('verify', { params: { token, audience: defaultAudience } }),
      {
        name: 'HttpStatusError',
        statusCode: 403,
        message: 'token has expired or was forged',
      }
    );
  });

  describe('valid token', function suite() {
    const jwt = require('../../../src/utils/jwt');

    beforeEach(async function pretest() {
      const { user } = await ctx.service.dispatch('register', { params: {
        username: 'v@makeomatic.ru',
        password: '123',
        audience: 'test',
        activate: true,
        metadata: {
          fine: true,
          bogus: '12938109381092',
        },
      } });

      this.userId = user.id;
    });

    beforeEach(async function pretest() {
      const data = await jwt.login.call(ctx.service, this.userId, 'test');
      this.token = data.jwt;

      // assert that this.token has embedded fields we need
      const decoded = JSON.parse(Buffer.from(this.token.split('.')[1], 'base64'));

      assert.equal(decoded.extra.username, 'v@makeomatic.ru');
      assert.equal(decoded.extra.bogus, '12938109381092');
      assert(/^\d+$/.test(decoded.username));
    });

    it('must return user object and required audiences information on a valid JWT token', async () => {
      return ctx.service
        .dispatch('verify', { params: { token: this.token, audience: 'test' } })
        .then((verify) => {
          assert.ok(verify.id);
          expect(verify.metadata['*.localhost'].username).to.be.eq('v@makeomatic.ru');
          expect(verify.metadata.test).to.be.deep.eq({
            fine: true,
            bogus: '12938109381092',
          });
        });
    });
  });
});
