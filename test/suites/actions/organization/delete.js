/* eslint-disable promise/always-return, no-prototype-builtins */
const { strict: assert } = require('assert');
const faker = require('faker');
const { createOrganization } = require('../../../helpers/organization');

describe('#delete organization', function registerSuite() {
  this.timeout(50000);

  beforeEach(global.startService);
  beforeEach(function pretest() {
    return createOrganization.call(this, {}, 2);
  });
  afterEach(global.clearRedis);

  it('must reject invalid organization params and return detailed error', async function test() {
    await assert.rejects(this.users.dispatch('organization.delete', { params: {} }), {
      name: 'HttpStatusError',
      errors: {
        length: 1,
      },
    });
  });

  it('must be able to remove organization', async function test() {
    const params = {
      organizationId: this.organization.id,
    };
    await this.users.dispatch('organization.delete', { params });
  });

  it('must return organization not exists error', async function test() {
    const params = {
      organizationId: faker.company.companyName(),
    };

    await assert.rejects(this.users.dispatch('organization.delete', { params }), {
      name: 'HttpStatusError',
      statusCode: 404,
    });
  });
});
