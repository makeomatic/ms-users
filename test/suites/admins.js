/* global startService */

const assert = require('assert');
const simpleDispatcher = require('../helpers/simpleDispatcher');

describe('#admins', function verifySuite() {
  const constants = require('../../src/constants');
  const ctx = {};

  let service;
  let dispatch;

  before(async () => {
    service = await startService.call(ctx, {
      admins: [{
        username: 'foobaz@makeomatic.ca',
        password: 'megalongsuperpasswordfortest',
        metadata: {
          firstName: 'Foo',
          lastName: 'Baz',
          roles: [constants.USERS_ADMIN_ROLE],
        },
      }],
      logger: {
        defaultLogger: true,
        debug: true,
      },
      initAdminAccountsDelay: 0,
    });

    dispatch = simpleDispatcher(service.router);
  });

  after(global.clearRedis.bind(ctx));

  it('should be able to login an admin', async () => {
    const { jwt } = await dispatch('users.login', {
      audience: '*.localhost',
      password: 'megalongsuperpasswordfortest',
      username: 'foobaz@makeomatic.ca',
    });

    assert.ok(jwt);
  });
});
