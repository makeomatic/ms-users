/* eslint-disable promise/always-return, no-prototype-builtins */
const { inspectPromise } = require('@makeomatic/deploy');
const assert = require('assert');
const faker = require('faker');
const { createOrganization } = require('../../helpers/organization');

describe('#organization members metadata', function registerSuite() {
  this.timeout(50000);

  beforeEach(global.startService);
  beforeEach(function () { return createOrganization.call(this); });
  afterEach(global.clearRedis);

  it('must reject invalid organization params and return detailed error', function test() {
    return this.dispatch('users.organization.getMetadata', {})
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
        assert.equal(response.errors.length, 1);
      });
  });

  it('must be able to return metadata', async function test() {
    const opts = {
      name: this.organization.name,
    };

    return this.dispatch('users.organization.getMetadata', opts)
      .reflect()
      .then(inspectPromise(true))
      .then((response) => {
        assert.ok(response.metadata);
        assert.deepEqual(response.metadata, this.organization.metadata);
      });
  });

  it('must return organization not found error', async function test() {
    const opts = {
      name: faker.company.companyName(),
    };

    return this.dispatch('users.organization.getMetadata', opts)
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
      });
  });
});
