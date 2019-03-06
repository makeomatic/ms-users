/* eslint-disable promise/always-return, no-prototype-builtins */
const { inspectPromise } = require('@makeomatic/deploy');
const assert = require('assert');

describe('#create organization', function registerSuite() {
  this.timeout(50000);

  beforeEach(global.startService);
  afterEach(global.clearRedis);

  it('must reject invalid organization params and return detailed error', function test() {
    return this.dispatch('users.organization.updateMetadata', {})
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
        assert.equal(response.errors.length, 1);
      });
  });

  it('must be able to update organization', async function test() {
    const opts = {
      name: 'Pied Piper',
      metadata: {
        description: 'test organization',
      },
    };
    const updatedOpts = {
      name: 'Pied Piper',
      metadata: {
        $set: { address: 'test' },
        $remove: ['description'],
      },
    };

    await this.dispatch('users.organization.create', opts).reflect();
    return this.dispatch('users.organization.updateMetadata', updatedOpts)
      .reflect()
      .then(inspectPromise(true))
      .then((createdOrganization) => {
        assert(createdOrganization.name === opts.name);
        assert(createdOrganization.metadata.description === undefined);
        assert(createdOrganization.metadata.address === 'test');
        assert.ok(createdOrganization.id);
        assert.ok(createdOrganization.active);
      });
  });

  it('must return organization not found error', async function test() {
    const opts = {
      name: 'Pied Piper',
    };

    return this.dispatch('users.organization.updateMetadata', opts)
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
      });
  });
});
