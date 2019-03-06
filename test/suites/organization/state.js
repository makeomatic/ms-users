/* eslint-disable promise/always-return, no-prototype-builtins */
const { inspectPromise } = require('@makeomatic/deploy');
const assert = require('assert');

describe('#create organization', function registerSuite() {
  this.timeout(50000);

  beforeEach(global.startService);
  afterEach(global.clearRedis);

  it('must reject invalid organization params and return detailed error', function test() {
    return this.dispatch('users.organization.state', {})
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
        assert.equal(response.errors.length, 2);
      });
  });

  it('must be able to update organization state', async function test() {
    const opts = {
      name: 'Pied Piper',
    };

    await this.dispatch('users.organization.create', opts).reflect();
    return this.dispatch('users.organization.state', { ...opts, active: true })
      .reflect()
      .then(inspectPromise(true))
      .then((createdOrganization) => {
        assert(createdOrganization.name === opts.name);
        assert(createdOrganization.active);
      });
  });

  it('must return organization not found error', async function test() {
    const opts = {
      name: 'Pied Piper',
    };

    return this.dispatch('users.organization.state', opts)
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
      });
  });
});
