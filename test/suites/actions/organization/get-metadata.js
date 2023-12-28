const assert = require('node:assert/strict');
const { faker } = require('@faker-js/faker');
const { startService, clearRedis } = require('../../../config');
const { createOrganization } = require('../../../helpers/organization');

describe('#organization members metadata', function registerSuite() {
  this.timeout(50000);

  beforeEach(startService);
  beforeEach(function pretest() {
    return createOrganization.call(this);
  });
  afterEach(clearRedis);

  it('must reject invalid organization params and return detailed error', async function test() {
    await assert.rejects(this.users.dispatch('organization.getMetadata', { params: {} }), {
      name: 'HttpStatusError',
      statusCode: 400,
      message: "organization.getMetadata validation failed: data must have required property 'organizationId'",
    });
  });

  it('must be able to return metadata', async function test() {
    const opts = {
      organizationId: this.organization.id,
    };

    return this.users.dispatch('organization.getMetadata', { params: opts })
      .then((response) => {
        assert.ok(response.data.attributes);
        assert.deepEqual(response.data.attributes, this.organization.metadata);
      });
  });

  it('must return organization not found error', async function test() {
    const opts = {
      organizationId: faker.company.name(),
    };

    await assert.rejects(this.users.dispatch('organization.getMetadata', { params: opts }), {
      name: 'HttpStatusError',
    });
  });
});
