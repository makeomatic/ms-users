/* eslint-disable promise/always-return, no-prototype-builtins */
const { inspectPromise } = require('@makeomatic/deploy');
const assert = require('assert');
const faker = require('faker');
const { createOrganization } = require('../../helpers/organization');

describe('#delete organization', function registerSuite() {
  this.timeout(50000);

  beforeEach(global.startService);
  beforeEach(function () { return createOrganization.call(this, {}, 2); });
  afterEach(global.clearRedis);

  it('must reject invalid organization params and return detailed error', function test() {
    return this.dispatch('users.organization.delete', {})
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
        assert.equal(response.errors.length, 1);
      });
  });

  it('must be able to remove organization', async function test() {
    const params = {
      organizationId: this.organization.id,
    };
    return this.dispatch('users.organization.delete', params)
      .reflect()
      .then(inspectPromise());
  });

  it('must return organization not exists error', async function test() {
    const params = {
      organizationId: faker.company.companyName(),
    };

    return this.dispatch('users.organization.delete', params)
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
      });
  });
});
