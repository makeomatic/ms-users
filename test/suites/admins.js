/* global inspectPromise */
const assert = require('assert');
const constants = require('../../src/constants.js');
const simpleDispatcher = require('./../helpers/simpleDispatcher');
const Users = require('../../src');

describe('#admins', function verifySuite() {
  // this.users used for cleanup redis hook
  const service = this.users = new Users({
    amqp: global.AMQP_OPTS,
    redis: global.REDIS,
    admins: [
      {
        username: 'foobaz@bar.ru',
        password: 'megalongsuperpasswordfortest',
        metadata: {
          firstName: 'Foo',
          lastName: 'Baz',
          roles: [constants.USERS_ADMIN_ROLE],
        },
      },
    ],
    initAdminAccountsDelay: 0,
  });

  before(() => service.connect());
  after(global.clearRedis.bind(this));

  it('should create admins accounts', () => {
    return service.initAdminAccounts()
      .then(() => simpleDispatcher(service.router)('users.list', { audience: '*.localhost' }))
      .reflect()
      .then(inspectPromise())
      .then(result => {
        assert.equal(result.users[0].id, 'foobaz@bar.ru');
      });
  });

  it('should be able to login an admin', () => {
    return simpleDispatcher(service.router)('users.login', {
      audience: '*.localhost',
      password: 'megalongsuperpasswordfortest',
      username: 'foobaz@bar.ru',
    })
    .reflect()
    .then(inspectPromise())
    .then(result => {
      assert.ok(result.jwt);
    });
  });
});
