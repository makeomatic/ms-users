const { strict: assert } = require('assert');
const { faker } = require('@faker-js/faker');
const { startService, clearRedis } = require('../../../config');
const { createOrganization, createMembers } = require('../../../helpers/organization');

describe('#switch state organization', function registerSuite() {
  this.timeout(50000);

  beforeEach(startService);
  beforeEach(function pretest() { return createMembers.call(this); });
  beforeEach(function pretest() { return createOrganization.call(this); });
  afterEach(clearRedis);

  it('must reject invalid organization params and return detailed error', async function test() {
    await assert.rejects(this.users.dispatch('organization.state', { params: {} }), {
      name: 'HttpStatusError',
      message: 'organization.state validation failed: '
        + "data must have required property 'organizationId', data must have required property 'active'",
      statusCode: 400,
    });
  });

  it('must be able to update organization state', async function test() {
    const opts = {
      organizationId: this.organization.id,
    };

    return this.users.dispatch('organization.state', { params: { ...opts, active: true } })
      .then((response) => {
        assert(response.data.attributes.active);
      });
  });

  it('must return organization not found error', async function test() {
    const params = {
      organizationId: faker.company.name(),
    };

    await assert.rejects(this.users.dispatch('organization.state', { params }), {
      name: 'HttpStatusError',
    });
  });
});
