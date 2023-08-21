const { strict: assert } = require('assert');
const { startService, clearRedis } = require('../../../config');
const { ErrorOrganizationNotFound, USERS_INVALID_TOKEN } = require('../../../../src/constants');
const { decodeAndVerify } = require('../../../../src/utils/jwt');

describe('/bypass/generic', function bypassGeneric() {
  const genericUser = { userId: '12341234' };
  const genericUserWithProfile = { profile: { name: 'FooBar' }, userId: '1234123422' };
  const account = 'kz';
  const schema = 'generic';
  const action = 'auth-bypass';
  const organizationId = '7014691412335263711';

  let userId;
  let username;
  let jwt;
  let audience;

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
          subaccounts: ['kz'],
        },
      },
    });

    audience = this.users.config.jwt.defaultAudience;
  });

  after(clearRedis.bind(this));

  it('[init] register generic provider user', async () => {
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

    assert(metadata[audience]);
    assert(metadata[audience].id);
    assert(metadata[audience]);
    assert(metadata[audience].organizationId);

    const orgId = metadata[audience].organizationId;
    const expectedUserName = `g/${orgId}-${genericUser.userId}`;

    assert.equal(metadata[audience].username, expectedUserName);

    assert(repsonse.jwt);
    const decodedToken = await decodeAndVerify(this.users, repsonse.jwt, audience);
    assert(decodedToken.username);
    assert(decodedToken.aud);
    assert(decodedToken.extra);
    assert(decodedToken.extra.username);
    assert(decodedToken.extra.organizationId);

    assert.equal(decodedToken.aud, audience);
    assert.equal(decodedToken.extra.username, expectedUserName);
    assert.equal(decodedToken.extra.organizationId, orgId);

    userId = metadata[audience].id;
    username = metadata[audience].username;
    jwt = repsonse.jwt;
  });

  it('[init] register generic provider user + profile', async () => {
    const repsonse = await this.users.dispatch(action, {
      params: {
        schema: `${schema}:${account}`,
        userKey: genericUserWithProfile.userId,
        organizationId,
        profile: genericUserWithProfile.profile,
        init: true,
      },
    });

    assert(repsonse.user.metadata);
    const { metadata } = repsonse.user;

    assert(metadata[audience]);
    assert(metadata[audience].id);
    assert.equal(metadata[audience].name, genericUserWithProfile.profile.name);
    assert(metadata[audience]);
    assert(metadata[audience].organizationId);

    const orgId = metadata[audience].organizationId;
    const expectedUserName = `g/${orgId}-${genericUserWithProfile.userId}`;

    assert.equal(metadata[audience].username, expectedUserName);

    assert(repsonse.jwt);
    const decodedToken = await decodeAndVerify(this.users, repsonse.jwt, audience);
    assert(decodedToken.username);
    assert(decodedToken.aud);
    assert(decodedToken.extra);
    assert(decodedToken.extra.username);
    assert(decodedToken.extra.organizationId);

    assert.equal(decodedToken.aud, audience);
    assert.equal(decodedToken.extra.username, expectedUserName);
    assert.equal(decodedToken.extra.organizationId, orgId);
  });

  it('[init] should login already registred generic provider user', async () => {
    const repsonse = await this.users.dispatch(action, {
      params: {
        schema: `${schema}:${account}`,
        userKey: genericUser.userId,
        organizationId,
        init: true,
      },
    });

    assert(repsonse.jwt);
    assert(repsonse.user.metadata[audience]);
    assert(repsonse.user.metadata[audience].id);
    assert.equal(repsonse.user.metadata[audience].id, userId);
    assert.equal(repsonse.user.metadata[audience].username, username);
  });

  it('should login with JWT', async () => {
    const repsonse = await this.users.dispatch(action, {
      params: {
        schema: `${schema}:${account}`,
        userKey: jwt,
        organizationId,
      },
    });

    assert(repsonse.jwt);
    assert(repsonse.user.metadata[audience]);
    assert(repsonse.user.metadata[audience].id);
    assert.equal(repsonse.user.metadata[audience].id, userId);
    assert.equal(repsonse.user.metadata[audience].username, username);
  });

  it('should not login with wrong JWT', async () => {
    const login = this.users.dispatch(action, {
      params: {
        schema: `${schema}:${account}`,
        userKey: jwt.slice(0, -2),
        organizationId,
      },
    });

    await assert.rejects(login, USERS_INVALID_TOKEN);
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

  it('should not register with inappropriate subaccount name', async () => {
    const register = this.users.dispatch(action, {
      params: {
        schema: `${schema}:lasa`,
        userKey: genericUser.userId,
        init: true,
      },
    });

    await assert.rejects(register, { statusCode: 400 });
  });
});
