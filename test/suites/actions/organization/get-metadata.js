const { strict: assert } = require('assert');
const faker = require('faker');
const { createOrganization } = require('../../../helpers/organization');

describe('#organization members metadata', function registerSuite() {
  this.timeout(50000);

  beforeEach(global.startService);
  beforeEach(function pretest() {
    return createOrganization.call(this);
  });
  afterEach(global.clearRedis);

  it('must reject invalid organization params and return detailed error', async function test() {
    await assert.rejects(this.users.dispatch('organization.getMetadata', { params: {} }), {
      name: 'HttpStatusError',
      errors: {
        length: 1,
      },
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
      organizationId: faker.company.companyName(),
    };

    await assert.rejects(this.users.dispatch('organization.getMetadata', { params: opts }), {
      name: 'HttpStatusError',
    });
  });
});
