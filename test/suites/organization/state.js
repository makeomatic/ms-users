/* eslint-disable promise/always-return, no-prototype-builtins */
const { inspectPromise } = require('@makeomatic/deploy');
const assert = require('assert');
const faker = require('faker');
const { createOrganization, registerMembers } = require('../../helpers/organization');

describe('#switch state organization', function registerSuite() {
  this.timeout(50000);

  beforeEach(global.startService);
  beforeEach(function () { return registerMembers.call(this); });
  beforeEach(function () { return createOrganization.call(this); });
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
      name: this.organization.name,
    };

    return this.dispatch('users.organization.state', { ...opts, active: true })
      .reflect()
      .then(inspectPromise(true))
      .then((createdOrganization) => {
        assert(createdOrganization.name === opts.name);
        assert(createdOrganization.active);
      });
  });

  it('must return organization not found error', async function test() {
    const opts = {
      name: faker.company.companyName(),
    };

    return this.dispatch('users.organization.state', opts)
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
      });
  });
});
