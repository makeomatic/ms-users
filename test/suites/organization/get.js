/* eslint-disable promise/always-return, no-prototype-builtins */
const { inspectPromise } = require('@makeomatic/deploy');
const assert = require('assert');
const faker = require('faker');
const { createOrganization } = require('../../helpers/organization');

describe('#get organization', function registerSuite() {
  this.timeout(50000);

  beforeEach(global.startService);
  beforeEach(function () { return createOrganization.call(this, {}, 2); });
  afterEach(global.clearRedis);

  it('must reject invalid organization params and return detailed error', function test() {
    return this.dispatch('users.organization.get', {})
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
        assert.equal(response.errors.length, 1);
      });
  });

  it('must be able to get organization', async function test() {
    const { invites, ...organization } = this.organization
    return this.dispatch('users.organization.get', { name: this.organization.name })
      .reflect()
      .then(inspectPromise(true))
      .then((response) => {
        assert.deepEqual(response, organization);
      });
  });

  it('must return organization not found error', async function test() {
    const opts = {
      name: faker.company.companyName(),
    };

    return this.dispatch('users.organization.get', opts)
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
      });
  });
});
