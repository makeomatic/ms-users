const { strict: assert } = require('assert');
const { faker } = require('@faker-js/faker');
const { createOrganization, createMembers } = require('../../../../helpers/organization');

describe('#remove member from organization', function registerSuite() {
  this.timeout(50000);

  beforeEach(global.startService);
  beforeEach(function pretest() { return createMembers.call(this); });
  beforeEach(function pretest() { return createOrganization.call(this); });
  afterEach(global.clearRedis);

  it('must reject invalid organization params and return detailed error', async function test() {
    await assert.rejects(this.users.dispatch('organization.members.remove', { params: {} }), {
      name: 'HttpStatusError',
      statusCode: 400,
      message: 'organization.members.remove validation failed: '
        + "data must have required property 'organizationId', data must have required property 'username'",
    });
  });

  it('must be able to remove member', async function test() {
    const opts = {
      organizationId: this.organization.id,
      username: this.userNames[0].email,
    };

    await this.users.dispatch('organization.members.remove', { params: opts });

    return this.users.dispatch('organization.members.list', { params: { organizationId: this.organization.id } })
      .then((response) => {
        assert.strictEqual(response.data.attributes.find(({ attributes }) => attributes.username === this.userNames[0].email), undefined);
      });
  });

  it('must return organization not found error', async function test() {
    const opts = {
      organizationId: faker.company.companyName(),
      username: faker.internet.email(),
    };

    await assert.rejects(this.users.dispatch('organization.members.remove', { params: opts }), {
      name: 'HttpStatusError',
    });
  });
});
