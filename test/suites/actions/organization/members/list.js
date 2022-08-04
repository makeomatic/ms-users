const { strict: assert } = require('assert');
const { faker } = require('@faker-js/faker');
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
      statusCode: 400,
      message: "organization.members.list validation failed: data must have required property 'organizationId'",
    });
  });

  it('must be able to return list of members', async function test() {
    const opts = {
      organizationId: this.organization.id,
    };

    const reply = await this.users.dispatch('organization.members.list', { params: opts });

    await this.users.validator.validate('organization.members.list.response', reply);

    assert.ok(reply.data.attributes);
    assert.equal(reply.data.attributes.length, 5);
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
