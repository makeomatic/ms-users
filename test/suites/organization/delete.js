/* eslint-disable promise/always-return, no-prototype-builtins */
const { inspectPromise } = require('@makeomatic/deploy');
const assert = require('assert');

describe('#delete organization', function registerSuite() {
  this.timeout(50000);

  beforeEach(global.startService);
  afterEach(global.clearRedis);

  it('must reject invalid organization params and return detailed error', function test() {
    return this.dispatch('users.organization.delete', {})
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
        assert.equal(response.errors.length, 1);
      });
  });

  it('must be able to remove organization', async function test() {
    const opts = {
      name: 'Pied Piper',
    };

    await this.dispatch('users.organization.create', opts).reflect();
    return this.dispatch('users.organization.delete', opts)
      .reflect()
      .then(inspectPromise());
  });

  it('must return organization not exists error', async function test() {
    const opts = {
      name: 'Pied Piper',
    };

    return this.dispatch('users.organization.delete', opts)
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
      });
  });
});
