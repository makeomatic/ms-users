const { strict: assert } = require('assert');
const faker = require('faker');
const { createOrganization } = require('../../../helpers/organization');

describe('#get organization', function registerSuite() {
  this.timeout(50000);

  beforeEach(global.startService);
  beforeEach(function pretest() {
    return createOrganization.call(this, {}, 2);
  });
  afterEach(global.clearRedis);

  it('must reject invalid organization params and return detailed error', async function test() {
    await assert.rejects(this.users.dispatch('organization.get', { params: {} }), {
      name: 'HttpStatusError',
      statusCode: 400,
      message: "organization.get validation failed: data must have required property 'organizationId'",
    });
  });

  it('must be able to get organization', async function test() {
    const { invites, ...organization } = this.organization;
    return this.users.dispatch('organization.get', { params: { organizationId: this.organization.id } })
      .then((response) => {
        assert.deepEqual(response.data.attributes, organization);
      });
  });

  it('must return organization not found error', async function test() {
    const opts = {
      organizationId: faker.company.companyName(),
    };

    await assert.rejects(this.users.dispatch('organization.get', { params: opts }), {
      name: 'HttpStatusError',
      statusCode: 404,
    });
  });
});
