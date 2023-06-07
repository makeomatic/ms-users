const { strict: assert } = require('assert');
const { faker } = require('@faker-js/faker');
const { startService, clearRedis } = require('../../../../config');
const { createOrganization } = require('../../../../helpers/organization');

describe('#add member to organization', function registerSuite() {
  this.timeout(50000);

  beforeEach(startService);
  beforeEach(function pretest() { return createOrganization.call(this); });
  afterEach(clearRedis);

  it('must reject invalid organization params and return detailed error', async function test() {
    await assert.rejects(this.users.dispatch('organization.members.add', { params: {} }), {
      name: 'HttpStatusError',
      statusCode: 400,
      message: 'organization.members.add validation failed: '
        + "data must have required property 'organizationId', data must have required property 'member'",
    });
  });

  it('must be able to add member', async function test() {
    const opts = {
      organizationId: this.organization.id,
      member: {
        email: faker.internet.email(),
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
      },
    };

    await this.users.dispatch('organization.members.add', { params: opts });
  });

  it('must return organization not found error', async function test() {
    const opts = {
      organizationId: faker.company.name(),
      member: {
        email: faker.internet.email(),
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
      },
    };

    await assert.rejects(this.users.dispatch('organization.members.add', { params: opts }), {
      name: 'HttpStatusError',
    });
  });
});
