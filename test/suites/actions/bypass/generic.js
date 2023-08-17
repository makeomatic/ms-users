const { strict: assert } = require('assert');
const { startService, clearRedis } = require('../../../config');
const { ErrorOrganizationNotFound } = require('../../../../src/constants');

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
      },
    });

    assert(repsonse.jwt);
    assert(repsonse.user.metadata);

    const { metadata } = repsonse.user;

    assert(metadata[genericUser.audience]);
    assert(metadata[genericUser.audience].id);
    assert.equal(metadata[genericUser.audience].name, genericUser.username);
    assert(metadata[genericUser.audience]);
    assert(metadata[genericUser.audience].organizationId);
    const orgId = metadata[genericUser.audience].organizationId;
    assert.equal(metadata[genericUser.audience].username, `g/${orgId}-${genericUser.userId}`);

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
      },
    });

    await assert.rejects(register, ErrorOrganizationNotFound);
  });
});
