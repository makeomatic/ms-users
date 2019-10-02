/* eslint-disable promise/always-return, no-prototype-builtins */
const { inspectPromise } = require('@makeomatic/deploy');
const assert = require('assert');
const faker = require('faker');
const uuid = require('uuid');
const { createMembers, createOrganization } = require('../../../helpers/organization');

describe('#accept invite organization', function registerSuite() {
  this.timeout(50000);

  beforeEach(global.startService);
  beforeEach(function pretest() { return createMembers.call(this, 1, true); });
  beforeEach(function pretest() { return createOrganization.call(this, {}, 1); });
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
      organizationId: this.organization.id,
      username: this.userNames[0].email,
      inviteToken: this.organization.invites[0].context.token.secret,
    };

    await this.dispatch('users.organization.invites.accept', opts);
  });

  it('must return organization not found error', async function test() {
    const opts = {
      organizationId: faker.company.companyName(),
      username: faker.internet.email(),
      inviteToken: uuid.v4(),
    };

    return this.dispatch('users.organization.invites.accept', opts)
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
        assert.equal(response.message, 'organization not found');
      });
  });

  it('must return user not found error', async function test() {
    const acceptOpts = {
      organizationId: this.organization.id,
      username: faker.internet.email(),
      inviteToken: uuid.v4(),
    };

    return this.dispatch('users.organization.invites.accept', acceptOpts)
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
        assert.ok(response.message.includes('does not exist'));
      });
  });
});
