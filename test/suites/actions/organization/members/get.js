const { strict: assert } = require('assert');
const { expect } = require('chai');
const { createOrganization, createMembers } = require('../../../../helpers/organization');

describe('#get organization member', function registerSuite() {
  this.timeout(50000);

  beforeEach(global.startService);
  beforeEach(function pretest() { return createMembers.call(this); });
  beforeEach(function pretest() { return createOrganization.call(this); });
  afterEach(global.clearRedis);

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

    const reply = await this.users.dispatch('organization.members.get', { params: opts });
    await this.users.validator.validate('organization.members.get.response', reply);

    expect(reply.data).to.have.ownProperty('id');
    expect(reply.data).to.have.ownProperty('type');
    assert.deepEqual(reply.data.attributes.username, opts.username);
  });
});
