const { strict: assert } = require('assert');
const { startService, clearRedis } = require('../../../config');
const { ErrorOrganizationNotFound } = require('../../../../src/constants');
const { decodeAndVerify } = require('../../../../src/utils/jwt');

describe('/bypass/generic', function bypassGeneric() {
  const genericUser = { username: 'FooBar', audience: '*.localhost', userId: '12341234' };
  const account = genericUser.username;
  const schema = 'generic';
  const action = 'auth-bypass';
  const organizationId = '7014691412335263711';

  let userId;
  let username;

  before('start', async () => {
    await startService.call(this, {
      jwt: {
        stateless: {
          enabled: true,
          fields: ['username', 'extra', 'organizationId'],
        },
      },
      bypass: {
        generic: {
          enabled: true,
          provider: 'generic',
        },
      },
    });
  });

  after(clearRedis.bind(this));

  it('register generic provider user', async () => {
    const repsonse = await this.users.dispatch(action, {
      params: {
        schema: `${schema}:${account}`,
        userKey: genericUser.userId,
        organizationId,
        init: true,
      },
    });

    assert(repsonse.user.metadata);
    const { metadata } = repsonse.user;

    assert(metadata[genericUser.audience]);
    assert(metadata[genericUser.audience].id);
    assert.equal(metadata[genericUser.audience].name, genericUser.username);
    assert(metadata[genericUser.audience]);
    assert(metadata[genericUser.audience].organizationId);

    const orgId = metadata[genericUser.audience].organizationId;
    const expectedUserName = `g/${orgId}-${genericUser.userId}`;

    assert.equal(metadata[genericUser.audience].username, expectedUserName);

    assert(repsonse.jwt);
    const decodedToken = await decodeAndVerify(this.users, repsonse.jwt, genericUser.audience);
    assert(decodedToken.username);
    assert(decodedToken.aud);
    assert(decodedToken.extra);
    assert(decodedToken.extra.username);
    assert(decodedToken.extra.organizationId);

    assert.equal(decodedToken.aud, genericUser.audience);
    assert.equal(decodedToken.extra.username, expectedUserName);
    assert.equal(decodedToken.extra.organizationId, orgId);

    userId = metadata[genericUser.audience].id;
    username = metadata[genericUser.audience].username;
  });

  it('should login already registred generic provider user', async () => {
    const repsonse = await this.users.dispatch(action, {
      params: {
        schema: `${schema}:${account}`,
        userKey: genericUser.userId,
        organizationId,
      },
    });

    assert(repsonse.jwt);
    assert(repsonse.user.metadata[genericUser.audience]);
    assert(repsonse.user.metadata[genericUser.audience].id);
    assert.equal(repsonse.user.metadata[genericUser.audience].id, userId);
    assert.equal(repsonse.user.metadata[genericUser.audience].username, username);
  });

  it('should not register user if organizationId not provided', async () => {
    const register = this.users.dispatch(action, {
      params: {
        schema: `${schema}:${account}`,
        userKey: genericUser.userId,
        init: true,
      },
    });

    await assert.rejects(register, ErrorOrganizationNotFound);
  });
});
