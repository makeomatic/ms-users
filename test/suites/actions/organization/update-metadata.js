const { strict: assert } = require('assert');
const { createMembers, createOrganization } = require('../../../helpers/organization');

describe('#update metadata organization', function registerSuite() {
  this.timeout(50000);

  beforeEach(global.startService);
  beforeEach(function pretest() { return createMembers.call(this, 2); });
  beforeEach(function pretest() { return createOrganization.call(this, {}, 2); });
  afterEach(global.clearRedis);

  it('must reject invalid organization params and return detailed error', async function test() {
    await assert.rejects(this.users.dispatch('organization.updateMetadata', { params: {} }), {
      name: 'HttpStatusError',
      statusCode: 400,
      message: 'organization.updateMetadata validation failed: '
        + "data must have required property 'organizationId', data must have required property 'metadata'",
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

    return this.users.dispatch('organization.updateMetadata', { params: updatedOpts })
      .then((createdOrganization) => {
        assert(createdOrganization.data.attributes.description === undefined);
        assert(createdOrganization.data.attributes.address === 'test');
      });
  });

  it('must be able to update and get custom audience organization metadata', async function test() {
    const updatedOpts = {
      organizationId: this.organization.id,
      audience: 'test-audience',
      metadata: {
        $set: { address: 'test-audience' },
      },
    };

    await this.users.dispatch('organization.updateMetadata', { params: updatedOpts })
      .then((createdOrganization) => {
        assert(createdOrganization.data.attributes.address === 'test-audience');
      });

    const opts = {
      organizationId: this.organization.id,
      audience: 'test-audience',
    };

    return this.users.dispatch('organization.getMetadata', { params: opts })
      .then((response) => {
        assert.ok(response.data.attributes);
        assert(response.data.attributes.address === 'test-audience');
      });
  });

  it('must return organization not found error', async function test() {
    const opts = {
      organizationId: '1234',
    };

    await assert.rejects(this.users.dispatch('organization.updateMetadata', { params: opts }), {
      name: 'HttpStatusError',
    });
  });
});
