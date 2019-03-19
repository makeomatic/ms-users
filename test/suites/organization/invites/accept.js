/* eslint-disable promise/always-return, no-prototype-builtins */
const { inspectPromise } = require('@makeomatic/deploy');
const assert = require('assert');
const faker = require('faker');
const { createMembers, createOrganization } = require('../../../helpers/organization');

describe('#accept invite organization', function registerSuite() {
  this.timeout(50000);

  beforeEach(global.startService);
  beforeEach(function () { return createMembers.call(this); });
  beforeEach(function () { return createOrganization.call(this); });
  afterEach(global.clearRedis);

  it('must reject invalid organization params and return detailed error', function test() {
    return this.dispatch('users.organization.invites.accept', {})
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
        assert.equal(response.errors.length, 3);
      });
  });

  it('must be able to accept invite to member', async function test() {
    const opts = {
      name: this.organization.name,
      username: this.userNames[0].username,
      inviteToken: 'token',
    };

    await this.dispatch('users.organization.invites.accept', opts)
      .reflect()
      .then(inspectPromise(true));
  });

  it('must return organization not found error', async function test() {
    const opts = {
      name: faker.company.companyName(),
      username: faker.internet.email(),
    };

    return this.dispatch('users.organization.invites.accept', opts)
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
        assert.equal(response.message, 'organization not found');
      });
  });

  it('must return user not organization member error', async function test() {
    const acceptOpts = {
      name: this.organization.name,
      username: faker.internet.email(),
    };

    return this.dispatch('users.organization.invites.accept', acceptOpts)
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
        assert.equal(response.message, 'username not member of organization');
      });
  });
});
