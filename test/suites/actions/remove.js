const assert = require('node:assert/strict');
const { USERS_ADMIN_ROLE } = require('../../../src/constants');
const { startService, clearRedis, globalRegisterUser } = require('../../config');

describe('#remove', function registerSuite() {
  beforeEach(startService);
  afterEach(clearRedis);

  // register 3 users
  beforeEach(globalRegisterUser('admin@me.com', { metadata: { roles: [USERS_ADMIN_ROLE] } }));
  beforeEach(globalRegisterUser('normal-1@me.com'));

  it('must reject invalid registration params and return detailed error', async function test() {
    await assert.rejects(this.users.dispatch('remove', { params: {} }), {
      name: 'HttpStatusError',
      statusCode: 400,
      message: "remove validation failed: data must have required property 'username'",
    });
  });

  it('must reject to remove an admin user', async function test() {
    await assert.rejects(this.users.dispatch('remove', { params: { username: 'admin@me.com' } }), {
      name: 'HttpStatusError',
      statusCode: 400,
    });
  });

  it('must fail to remove non-existing user', async function test() {
    await assert.rejects(this.users.dispatch('remove', { params: { username: 'normal-2@me.com' } }), {
      name: 'HttpStatusError',
      statusCode: 404,
    });
  });

  it('must remove registered user', async function test() {
    return this.users.dispatch('remove', { params: { username: 'normal-1@me.com' } });
  });
});
