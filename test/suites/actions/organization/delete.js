/* eslint-disable promise/always-return, no-prototype-builtins */
const assert = require('node:assert/strict');
const { faker } = require('@faker-js/faker');
const { createOrganization } = require('../../../helpers/organization');
const { startService, clearRedis } = require('../../../config');

describe('#delete organization', function registerSuite() {
  this.timeout(50000);

  beforeEach(startService);
  beforeEach(function pretest() {
    return createOrganization.call(this, {}, 2);
  });
  afterEach(clearRedis);

  it('must reject invalid organization params and return detailed error', async function test() {
    await assert.rejects(this.users.dispatch('organization.delete', { params: {} }), {
      name: 'HttpStatusError',
      statusCode: 400,
      message: "organization.delete validation failed: data must have required property 'organizationId'",
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
      organizationId: faker.company.name(),
    };

    await assert.rejects(this.users.dispatch('organization.delete', { params }), {
      name: 'HttpStatusError',
      statusCode: 404,
    });
  });
});
