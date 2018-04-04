const assert = require('assert');
const simpleDispatcher = require('../helpers/simpleDispatcher');
const { inspectPromise } = require('@makeomatic/deploy');

describe('#admins', function verifySuite() {
  const constants = require('../../src/constants');
  const Users = require('../../src');

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
    logger: {
      defaultLogger: true,
      debug: true,
    },
    initAdminAccountsDelay: 0,
  });

  before(async () => {
    await service.connect();
    this.dispatch = simpleDispatcher(service.router);
  });

  after(global.clearRedis.bind(this));

  it('should create admins accounts', () => {
    return service
      .initAdminAccounts()
      .then(() => this.dispatch('users.list', { audience: '*.localhost' }))
      .reflect()
      .then(inspectPromise())
      .then((result) => {
        assert.equal(result.users[0].metadata['*.localhost'].username, 'foobaz@bar.ru');
      });
  });

  it('should be able to login an admin', () => {
    return this
      .dispatch('users.login', {
        audience: '*.localhost',
        password: 'megalongsuperpasswordfortest',
        username: 'foobaz@bar.ru',
      })
      .reflect()
      .then(inspectPromise())
      .then((result) => {
        assert.ok(result.jwt);
      });
  });
});
