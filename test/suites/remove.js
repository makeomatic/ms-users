/* global inspectPromise, globalRegisterUser */
const assert = require('assert');
const { USERS_ADMIN_ROLE } = require('../../src/constants');
const simpleDispatcher = require('./../helpers/simpleDispatcher');

describe('#remove', function registerSuite() {
  const headers = { routingKey: 'users.remove' };

  beforeEach(global.startService);
  afterEach(global.clearRedis);

  // register 3 users
  beforeEach(globalRegisterUser('admin@me.com', { metadata: { roles: [USERS_ADMIN_ROLE] } }));
  beforeEach(globalRegisterUser('normal-1@me.com'));

  it('must reject invalid registration params and return detailed error', function test() {
    return simpleDispatcher(this.users.router)('users.remove', {})
      .reflect()
      .then(inspectPromise(false))
      .then(registered => {
        assert.equal(registered.name, 'ValidationError');
        assert.equal(registered.errors.length, 1);
      });
  });

  it('must reject to remove an admin user', function test() {
    return simpleDispatcher(this.users.router)('users.remove', { username: 'admin@me.com' })
      .reflect()
      .then(inspectPromise(false))
      .then(registered => {
        assert.equal(registered.name, 'HttpStatusError');
        assert.equal(registered.statusCode, 400);
      });
  });

  it('must fail to remove non-existing user', function test() {
    return simpleDispatcher(this.users.router)('users.remove', { username: 'normal-2@me.com' })
      .reflect()
      .then(inspectPromise(false))
      .then(registered => {
        assert.equal(registered.name, 'HttpStatusError');
        assert.equal(registered.statusCode, 404);
      });
  });

  it('must remove registered user', function test() {
    return simpleDispatcher(this.users.router)('users.remove', { username: 'normal-1@me.com' })
      .reflect()
      .then(inspectPromise());
  });
});
