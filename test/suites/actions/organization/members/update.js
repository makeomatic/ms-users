/* eslint-disable promise/always-return, no-prototype-builtins */
const { inspectPromise } = require('@makeomatic/deploy');
const assert = require('assert');
const { createOrganization, createMembers } = require('../../../../helpers/organization');

describe('#update organization member', function registerSuite() {
  this.timeout(50000);

  beforeEach(global.startService);
  beforeEach(function pretest() { return createMembers.call(this); });
  beforeEach(function pretest() { return createOrganization.call(this); });
  afterEach(global.clearRedis);

  it('must reject invalid params and return detailed error', function test() {
    return this.dispatch('users.organization.members.update', {})
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
        assert.equal(response.errors.length, 3);
      });
  });

  it('must be able to update member', async function test() {
    const opts = {
      organizationId: this.organization.id,
      username: this.userNames[0].email,
      data: {
        $set: {
          avatar: 'test-avatar',
        },
      },
    };

    await this.dispatch('users.organization.members.update', opts).then((response) => {
      assert.deepEqual(response.data.attributes.avatar, 'test-avatar');
    });
  });
});
