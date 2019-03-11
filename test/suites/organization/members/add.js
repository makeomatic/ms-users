/* eslint-disable promise/always-return, no-prototype-builtins */
const { inspectPromise } = require('@makeomatic/deploy');
const assert = require('assert');
const faker = require('faker');
const { createOrganization } = require('../../../helpers/organization');

describe('#add member to organization', function registerSuite() {
  this.timeout(50000);

  beforeEach(global.startService);
  beforeEach(function () { return createOrganization.call(this); });
  afterEach(global.clearRedis);

  it('must reject invalid organization params and return detailed error', function test() {
    return this.dispatch('users.organization.members.add', {})
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
        assert.equal(response.errors.length, 2);
      });
  });

  it('must be able to add member', async function test() {
    const opts = {
      name: this.organization.name,
      email: faker.internet.email(),
    };

    return this.dispatch('users.organization.members.add', opts)
      .reflect()
      .then(inspectPromise(true));
  });

  it('must return organization not found error', async function test() {
    const opts = {
      name: faker.company.companyName(),
      email: faker.internet.email(),
    };

    return this.dispatch('users.organization.members.add', opts)
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
      });
  });
});
