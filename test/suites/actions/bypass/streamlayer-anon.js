const { strict: assert } = require('node:assert');
const jose = require('jose');
const { v4 } = require('uuid');
const { encode } = require('z32');
const { promisify } = require('node:util');
const randomBytes = promisify(require('node:crypto').randomBytes);
const { startService, clearRedis } = require('../../../config');
const { createOrganization } = require('../../../helpers/organization');

describe('/bypass/streamlayer-anonymous', function bypassStreamlayer() {
  const userWithValidPassword = { username: 'v@makeomatic.ru', password: 'nicepassword1', audience: '*.localhost' };
  const schema = 'slra';

  let pub;

  before('start', async () => {
    await startService.call(this, {
      jwt: {
        stateless: {
          enabled: true,
          fields: ['username', 'extra', 'slra'],
        },
      },
      bypass: {
        slrAnonymous: {
          enabled: true,
        },
      },
    });

    await createOrganization.call(this, {}, 2);

    // emulating what needs to be done for anon service
    const { privateKey, publicKey } = await jose.generateKeyPair('ECDH-ES+A256KW');
    const jwk = await jose.exportJWK(privateKey);
    jwk.kid = await jose.calculateJwkThumbprint(jwk);

    // save for future encryption
    pub = await jose.exportJWK(publicKey);
    pub.kid = jwk.kid;
    pub.alg = 'ECDH-ES+A256KW';

    const { audience, totpKey, pkKey } = this.users.config.bypass.slrAnonymous;

    // pre-generate totp secret
    const totpSecret = encode(await randomBytes(20));

    // update metadata for the org
    await this.users.dispatch('organization.updateMetadata', {
      params: {
        organizationId: this.organization.id,
        audience,
        metadata: {
          $set: {
            [totpKey]: totpSecret,
            [pkKey]: jwk,
          },
        },
      },
    });
  });

  after(clearRedis.bind(this));
  afterEach(clearRedis.bind(this, true));

  it('authenticate user with legacy JWT and assing new JWT', async () => {
    const { idField, totpKey } = this.users.config.bypass.slrAnonymous;

    const { token } = await this.users.dispatch('auth-bypass', { params: {
      schema: `${schema}:${this.organization.id}`,
      userKey: pub.kid,
      init: true,
    } });

    assert(token);

    const deviceId = v4();
    const jwe = await new jose.EncryptJWT({ [idField]: deviceId, [totpKey]: token })
      .setProtectedHeader({ alg: pub.alg, enc: 'A256GCM', kid: pub.kid })
      .setIssuedAt()
      .setIssuer('io.streamlayer.ios')
      .setAudience(this.organization.id)
      .setExpirationTime('2m')
      .encrypt(await jose.importJWK(pub));

    const response = await this.users.dispatch('auth-bypass', {
      params: {
        schema: `${schema}:${this.organization.id}`,
        userKey: jwe,
      },
    });

    assert(response.jwt);
    assert(response.user.metadata[userWithValidPassword.audience]);
    assert(response.user.metadata[userWithValidPassword.audience].username, `sla/${deviceId}`);
    assert(response.user.metadata[userWithValidPassword.audience].slra);
    assert.equal(response.user.metadata[userWithValidPassword.audience].slra.id, deviceId);
  });

  it('should not authenticate user with incorrect schema', async () => {
    const notExistsSchema = 'internal';

    const repsonse = this.users.dispatch('auth-bypass', { params: {
      schema: `${notExistsSchema}:org-doesnt-exist`,
      userKey: 'oh-lolol',
    } });

    await assert.rejects(repsonse, {
      name: 'HttpStatusError',
      statusCode: 412,
    });
  });
});
