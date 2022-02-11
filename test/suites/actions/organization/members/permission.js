const { strict: assert } = require('assert');
const faker = require('faker');
const { createOrganization, createMembers } = require('../../../../helpers/organization');

describe('#edit member permission', function registerSuite() {
  this.timeout(50000);

  beforeEach(global.startService);
  beforeEach(function pretest() { return createMembers.call(this, 1); });
  beforeEach(function pretest() { return createOrganization.call(this); });
  afterEach(global.clearRedis);

  it('must reject invalid organization params and return detailed error', async function test() {
    await assert.rejects(this.users.dispatch('organization.members.permission', { params: {} }), {
      name: 'HttpStatusError',
      statusCode: 400,
      message: 'organization.members.permission validation failed: '
        + "data must have required property 'organizationId', "
        + "data must have required property 'username', "
        + "data must have required property 'permission'",
    });
  });

  it('must be able to edit member permission', async function test() {
    const opts = {
      organizationId: this.organization.id,
      username: this.userNames[0].email,
      permission: {
        $set: ['admin'],
      },
    };

    await this.users.dispatch('organization.members.permission', { params: opts });

    return this.users.dispatch('organization.members.list', { params: { organizationId: this.organization.id } })
      .then((response) => {
        assert.deepStrictEqual(response.data.attributes[0].attributes.permissions, ['admin']);
      });
  });

  it('must return organization not found error', async function test() {
    const opts = {
      organizationId: faker.company.companyName(),
      username: faker.internet.email(),
      permission: {
        $set: ['admin'],
      },
    };

    await assert.rejects(this.users.dispatch('organization.members.permission', { params: opts }), {
      name: 'HttpStatusError',
    });
  });

  it('must return user not found error', async function test() {
    const opts = {
      organizationId: this.organization.name,
      username: faker.internet.email(),
      permission: {
        $set: ['admin'],
      },
    };

    await assert.rejects(this.users.dispatch('organization.members.permission', { params: opts }), {
      name: 'HttpStatusError',
    });
  });
});
