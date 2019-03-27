/* eslint-disable promise/always-return, no-prototype-builtins */
const { inspectPromise } = require('@makeomatic/deploy');
const assert = require('assert');
const faker = require('faker');
const { createOrganization, createMembers } = require('../../../helpers/organization');

describe('#organization members list', function registerSuite() {
  this.timeout(50000);

  beforeEach(global.startService);
  beforeEach(function () { return createMembers.call(this, 5); });
  beforeEach(function () { return createOrganization.call(this, {}, 5); });
  afterEach(global.clearRedis);

  it('must reject invalid organization params and return detailed error', function test() {
    return this.dispatch('users.organization.members.list', {})
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
        assert.equal(response.errors.length, 1);
      });
  });

  it('must be able to return list of members', async function test() {
    const opts = {
      organizationId: this.organization.id,
    };

    return this.dispatch('users.organization.members.list', opts)
      .reflect()
      .then(inspectPromise(true))
      .then((response) => {
        assert.ok(response.data.members);
        assert.equal(response.data.members.length, 5);
      });
  });

  it('must return organization not found error', async function test() {
    const opts = {
      organizationId: faker.company.companyName(),
    };

    return this.dispatch('users.organization.members.list', opts)
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
      });
  });
});
