/* eslint-disable promise/always-return, no-prototype-builtins */
const { inspectPromise } = require('@makeomatic/deploy');
const assert = require('assert');
const { expect } = require('chai');
const { createOrganization, createMembers } = require('../../../../helpers/organization');

describe('#get organization member', function registerSuite() {
  this.timeout(50000);

  beforeEach(global.startService);
  beforeEach(function pretest() { return createMembers.call(this); });
  beforeEach(function pretest() { return createOrganization.call(this); });
  afterEach(global.clearRedis);

  it('must reject invalid params and return detailed error', function test() {
    return this.dispatch('users.organization.members.get', {})
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
        assert.equal(response.errors.length, 2);
      });
  });

  it('must be able to get member', async function test() {
    const opts = {
      organizationId: this.organization.id,
      username: this.userNames[0].email,
    };

    await this.dispatch('users.organization.members.get', opts).then((response) => {
      expect(response.data).to.have.ownProperty('id');
      expect(response.data).to.have.ownProperty('type');
      assert.deepEqual(response.data.attributes.username, opts.username);
    });
  });
});
