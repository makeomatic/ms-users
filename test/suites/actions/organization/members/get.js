/* eslint-disable no-prototype-builtins */
const assert = require('node:assert/strict');
const { startService, clearRedis } = require('../../../../config');
const { createOrganization, createMembers } = require('../../../../helpers/organization');

describe('#get organization member', function registerSuite() {
  this.timeout(50000);

  beforeEach(async function () {
    await startService.call(this, {
      organizations: {
        audience: 'organizations',
        showMfa: true,
      },
    });
  });
  beforeEach(function pretest() { return createMembers.call(this); });
  beforeEach(function pretest() { return createOrganization.call(this); });
  afterEach(clearRedis);

  it('must reject invalid params and return detailed error', async function test() {
    await assert.rejects(this.users.dispatch('organization.members.get', { params: {} }), {
      name: 'HttpStatusError',
      statusCode: 400,
      message: 'organization.members.get validation failed: '
        + "data must have required property 'organizationId', data must have required property 'username'",
    });
  });

  it('must be able to get member', async function test() {
    const opts = {
      organizationId: this.organization.id,
      username: this.userNames[0].email,
    };

    await this.users.dispatch('organization.members.get', { params: opts })
      .then((response) => {
        assert(response.data.hasOwnProperty('id'));
        assert(response.data.hasOwnProperty('type'));
        assert(response.data.hasOwnProperty('attributes'));
        assert(response.data.attributes.hasOwnProperty('mfaEnabled'));
        assert.deepEqual(response.data.attributes.username, opts.username);
      });
  });
});
