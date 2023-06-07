const { strict: assert } = require('assert');
const { startService, clearRedis } = require('../../../../config');
const { createOrganization, createMembers } = require('../../../../helpers/organization');

describe('#update organization member', function registerSuite() {
  this.timeout(50000);

  beforeEach(startService);
  beforeEach(function pretest() { return createMembers.call(this); });
  beforeEach(function pretest() { return createOrganization.call(this); });
  afterEach(clearRedis);

  it('must reject invalid params and return detailed error', async function test() {
    await assert.rejects(this.users.dispatch('organization.members.update', { params: {} }), {
      name: 'HttpStatusError',
      statusCode: 400,
      message: 'organization.members.update validation failed: '
        + "data must have required property 'organizationId', "
        + "data must have required property 'username', "
        + "data must have required property 'data'",
    });
  });

  it('must be able to update member', async function test() {
    const opts = {
      organizationId: this.organization.id,
      username: this.userNames[0].email,
      data: {
        $set: {
          avatar: 'test-avatar',
        },
      },
    };

    await this.users.dispatch('organization.members.update', { params: opts }).then((response) => {
      assert.deepEqual(response.data.attributes.avatar, 'test-avatar');
    });
  });
});
