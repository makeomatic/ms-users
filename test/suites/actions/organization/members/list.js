const { strict: assert } = require('assert');
const faker = require('faker');
const { createOrganization, createMembers } = require('../../../../helpers/organization');

describe('#organization members list', function registerSuite() {
  this.timeout(50000);

  beforeEach(global.startService);
  beforeEach(function pretest() { return createMembers.call(this, 5); });
  beforeEach(function pretest() { return createOrganization.call(this, {}, 5); });
  afterEach(global.clearRedis);

  it('must reject invalid organization params and return detailed error', async function test() {
    await assert.rejects(this.users.dispatch('organization.members.list', { params: {} }), {
      name: 'HttpStatusError',
      errors: { length: 1 },
    });
  });

  it('must be able to return list of members', async function test() {
    const opts = {
      organizationId: this.organization.id,
    };

    return this.users.dispatch('organization.members.list', { params: opts })
      .then((response) => {
        assert.ok(response.data.attributes);
        assert.equal(response.data.attributes.length, 5);
      });
  });

  it('must return organization not found error', async function test() {
    const opts = {
      organizationId: faker.company.companyName(),
    };

    await assert.rejects(this.users.dispatch('organization.members.list', { params: opts }), {
      name: 'HttpStatusError',
    });
  });
});
