/* eslint-disable promise/always-return, no-prototype-builtins */
const { inspectPromise } = require('@makeomatic/deploy');
const assert = require('assert');
const faker = require('faker');
const { createOrganization } = require('../../helpers/organization');

describe('#create organization', function registerSuite() {
  this.timeout(50000);

  beforeEach(global.startService);
  beforeEach(function () { return createOrganization.call(this, {}, 2); });
  afterEach(global.clearRedis);

  it('must reject invalid organization params and return detailed error', function test() {
    return this.users.dispatch('organization.create', { headers: this.bearerAuthHeaders })
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
        assert.equal(response.errors.length, 1);
      });
  });

  it('must be able to create organization', function test() {
    const params = {
      name: faker.company.companyName(),
      metadata: {
        description: 'test organization',
      },
      members: this.userNames.slice(0, 2),
    };

    return this.users.dispatch('organization.create', { params, headers: this.bearerAuthHeaders })
      .reflect()
      .then(inspectPromise(true))
      .then((createdOrganization) => {
        assert(createdOrganization.name === params.name);
        assert(createdOrganization.metadata.description === params.metadata.description);
        assert(createdOrganization.members.length === 2);
        assert.ok(createdOrganization.id);
        assert.ok(createdOrganization.active);
      });
  });

  it('must return organization exists error', async function test() {
    const params = {
      name: this.organization.name,
    };

    return this.users.dispatch('organization.create', { params, headers: this.bearerAuthHeaders })
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
      });
  });
});
