const { expect } = require('chai');
const simpleDispatcher = require('./../helpers/simpleDispatcher');

describe('#service', function verifySuite() {
  after(global.clearRedis.bind(this));

  it('should create admins accounts', done => {
    const Users = require('./../../src');
    const service = this.users = new Users({
      amqp: {
        transport: {
          connection: {
            host: 'rabbitmq',
            port: 5672,
          },
        }
      },
      redis: {
        hosts: [
          { host: 'redis-1', port: 6379 },
          { host: 'redis-2', port: 6379 },
          { host: 'redis-3', port: 6379 },
        ]
      },
      admins: [
        {
          username: 'foobaz@bar.ru',
          password: 'megalongsuperpasswordfortest',
          firstName: 'Foo',
          lastName: 'Baz',
        },
      ],
      initAdminAccountsDelay: 1,
    });

    service.connect()
      .then(() => service.initAdminAccounts())
      .then(() => simpleDispatcher(this.users.router)('users.list', { audience: '*.localhost' }))
      .reflect()
      .then(inspection => {
        expect(inspection.isFulfilled()).to.be.eq(true);
        expect(inspection.value().users[0].id).to.be.eq('foobaz@bar.ru');
        done();
      });
  });
});
