/* eslint-disable promise/always-return, no-prototype-builtins */
const { inspectPromise } = require('@makeomatic/deploy');
const assert = require('assert');
const faker = require('faker');
const { createOrganization, createMembers } = require('../../../helpers/organization');

describe('#remove member from organization', function registerSuite() {
  this.timeout(50000);

  beforeEach(global.startService);
  beforeEach(function pretest() { return createMembers.call(this); });
  beforeEach(function pretest() { return createOrganization.call(this); });
  afterEach(global.clearRedis);

  it('must reject invalid organization params and return detailed error', function test() {
    return this.dispatch('users.organization.members.remove', {})
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
        assert.equal(response.errors.length, 2);
      });
  });

  it('must be able to remove member', async function test() {
    const opts = {
      organizationId: this.organization.id,
      username: this.userNames[0].email,
    };

    return this.dispatch('users.organization.members.remove', opts)
      .reflect()
      .then(inspectPromise(true));
  });

  it('must return organization not found error', async function test() {
    const opts = {
      organizationId: faker.company.companyName(),
      username: faker.internet.email(),
    };

    return this.dispatch('users.organization.members.remove', opts)
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
      });
  });
});
