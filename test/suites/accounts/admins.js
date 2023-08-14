const { strict: assert } = require('assert');
const { startService, clearRedis } = require('../../config');

describe('#admins', function verifySuite() {
  const constants = require('../../../src/constants');
  const ctx = {};

  let service;

  before(async () => {
    service = await startService.call(ctx, {
      admins: [
        {
          username: 'admin0@x.com',
          password: 'megalongsuperpasswordfortest',
          metadata: {
            firstName: 'Im',
            lastName: 'Admin0',
          },
        },
        {
          username: 'admin1@x.com',
          password: 'megalongsuperpasswordfortest',
          metadata: {
            firstName: 'Im',
            lastName: 'Admin1',
            roles: [constants.USERS_ADMIN_ROLE],
          },
        },
        {
          username: 'user0@x.com',
          password: 'megalongsuperpasswordfortest',
          metadata: {
            firstName: 'Im',
            lastName: 'User0',
            roles: [],
          },
        },
      ],
      logger: {
        defaultLogger: true,
        debug: true,
      },
      initAdminAccountsDelay: 0,
    });
  });

  after(clearRedis.bind(ctx));

  it('should be able to login an admin', async () => {
    const admin0 = await service.dispatch('login', { params: {
      audience: '*.localhost',
      password: 'megalongsuperpasswordfortest',
      username: 'admin0@x.com',
    } });
    const admin1 = await service.dispatch('login', { params: {
      audience: '*.localhost',
      password: 'megalongsuperpasswordfortest',
      username: 'admin1@x.com',
    } });
    const user0 = await service.dispatch('login', { params: {
      audience: '*.localhost',
      password: 'megalongsuperpasswordfortest',
      username: 'user0@x.com',
    } });

    assert.ok(admin0.jwt);
    assert.ok(admin0.user.metadata['*.localhost'].roles.includes('admin'));
    assert.ok(admin1.jwt);
    assert.ok(admin1.user.metadata['*.localhost'].roles.includes('admin'));
    assert.ok(user0.jwt);
    assert.equal(user0.user.metadata['*.localhost'].roles.length, 0);
  });
});
