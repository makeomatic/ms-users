/* eslint-disable promise/always-return, no-prototype-builtins */
const { inspectPromise } = require('@makeomatic/deploy');
const assert = require('assert');
const faker = require('faker');
const { registerMembers } = require('../../helpers/organization');

describe('#create organization', function registerSuite() {
  this.timeout(50000);

  beforeEach(global.startService);
  beforeEach(function () { return registerMembers.call(this, 2); });
  afterEach(global.clearRedis);

  it('must reject invalid organization params and return detailed error', function test() {
    return this.dispatch('users.organization.create', {})
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
        assert.equal(response.errors.length, 1);
      });
  });

  it('must be able to create organization', function test() {
    const opts = {
      name: faker.company.companyName(),
      metadata: {
        description: 'test organization',
      },
      members: this.userNames.slice(0, 2),
    };

    return this.dispatch('users.organization.create', opts)
      .reflect()
      .then(inspectPromise(true))
      .then((createdOrganization) => {
        assert(createdOrganization.name === opts.name);
        assert(createdOrganization.metadata.description === opts.metadata.description);
        assert(createdOrganization.members.length === 2);
        assert.ok(createdOrganization.id);
        assert.ok(createdOrganization.active);
      });
  });

  it('must return organization exists error', async function test() {
    const opts = {
      name: faker.company.companyName(),
    };

    await this.dispatch('users.organization.create', opts).reflect();
    return this.dispatch('users.organization.create', opts)
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
      });
  });

  it('must return member not found error', async function test() {
    const opts = {
      name: faker.company.companyName(),
      members: [
        ...this.userNames.slice(0, 2),
        { username: faker.internet.email() },
      ],
    };

    return this.dispatch('users.organization.create', opts)
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
      });
  });
});
