/* eslint-disable promise/always-return, no-prototype-builtins */
const { inspectPromise } = require('@makeomatic/deploy');
const assert = require('assert');
const { createMembers, createOrganization } = require('../../helpers/organization');

describe('#update metadata organization', function registerSuite() {
  this.timeout(50000);

  beforeEach(global.startService);
  beforeEach(function () { return createMembers.call(this, 2); });
  beforeEach(function () { return createOrganization.call(this, {}, 2); });
  afterEach(global.clearRedis);

  it('must reject invalid organization params and return detailed error', function test() {
    return this.dispatch('users.organization.updateMetadata', {})
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
        assert.equal(response.errors.length, 2);
      });
  });

  it('must be able to update organization', async function test() {
    const updatedOpts = {
      organizationId: this.organization.id,
      metadata: {
        $set: { address: 'test' },
        $remove: ['description'],
      },
    };

    return this.dispatch('users.organization.updateMetadata', updatedOpts)
      .reflect()
      .then(inspectPromise(true))
      .then((createdOrganization) => {
        assert(createdOrganization.data.metadata.description === undefined);
        assert(createdOrganization.data.metadata.address === 'test');
      });
  });

  it('must return organization not found error', async function test() {
    const opts = {
      organizationId: '1234',
    };

    return this.dispatch('users.organization.updateMetadata', opts)
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
      });
  });
});
