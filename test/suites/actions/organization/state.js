/* eslint-disable promise/always-return, no-prototype-builtins */
const { inspectPromise } = require('@makeomatic/deploy');
const assert = require('assert');
const faker = require('faker');
const { createOrganization, createMembers } = require('../../../helpers/organization');

describe('#switch state organization', function registerSuite() {
  this.timeout(50000);

  beforeEach(global.startService);
  beforeEach(function pretest() { return createMembers.call(this); });
  beforeEach(function pretest() { return createOrganization.call(this); });
  afterEach(global.clearRedis);

  it('must reject invalid organization params and return detailed error', function test() {
    return this.dispatch('users.organization.state', {})
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
        assert.equal(response.errors.length, 2);
      });
  });

  it('must be able to update organization state', async function test() {
    const opts = {
      organizationId: this.organization.id,
    };

    return this.dispatch('users.organization.state', { ...opts, active: true })
      .then((response) => {
        assert(response.data.attributes.active);
      });
  });

  it('must return organization not found error', async function test() {
    const opts = {
      organizationId: faker.company.companyName(),
    };

    return this.dispatch('users.organization.state', opts)
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
      });
  });
});
