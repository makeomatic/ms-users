/* eslint-disable promise/always-return, no-prototype-builtins */
const { inspectPromise } = require('@makeomatic/deploy');
const assert = require('assert');
const faker = require('faker');
const { createOrganization, createMembers } = require('../../../../helpers/organization');

describe('#edit member permission', function registerSuite() {
  this.timeout(50000);

  beforeEach(global.startService);
  beforeEach(function pretest() { return createMembers.call(this, 1); });
  beforeEach(function pretest() { return createOrganization.call(this); });
  afterEach(global.clearRedis);

  it('must reject invalid organization params and return detailed error', function test() {
    return this.dispatch('users.organization.members.permission', {})
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
        assert.equal(response.errors.length, 3);
      });
  });

  it('must be able to edit member permission', async function test() {
    const opts = {
      organizationId: this.organization.id,
      username: this.userNames[0].email,
      permission: {
        $set: ['admin'],
      },
    };

    await this.dispatch('users.organization.members.permission', opts);

    return this.dispatch('users.organization.members.list', { organizationId: this.organization.id })
      .then((response) => {
        assert.deepStrictEqual(response.data.attributes[0].attributes.permissions, ['admin']);
      });
  });

  it('must return organization not found error', async function test() {
    const opts = {
      organizationId: faker.company.companyName(),
      username: faker.internet.email(),
      permission: {
        $set: ['admin'],
      },
    };

    return this.dispatch('users.organization.members.permission', opts)
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
      });
  });

  it('must return user not found error', async function test() {
    const opts = {
      organizationId: this.organization.name,
      username: faker.internet.email(),
      permission: {
        $set: ['admin'],
      },
    };

    return this.dispatch('users.organization.members.permission', opts)
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
      });
  });
});
