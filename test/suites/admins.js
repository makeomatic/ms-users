/* global inspectPromise */
const assert = require('assert');
const simpleDispatcher = require('./../helpers/simpleDispatcher');

describe('#service', function verifySuite() {
  after(global.clearRedis.bind(this));

  it('should create admins accounts', () => {
    const Users = require('../../src');
    const constants = require('../../src/constants.js');

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

    return service.connect()
      .then(() => service.initAdminAccounts())
      .then(() => simpleDispatcher(this.users.router)('users.list', { audience: '*.localhost' }))
      .reflect()
      .then(inspectPromise())
      .then(result => {
        assert(result.users[0].id).to.be.eq('foobaz@bar.ru');
      });
  });
});
