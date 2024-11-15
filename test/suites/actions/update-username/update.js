const { rejects, strictEqual } = require('node:assert');
const { stub } = require('sinon');

const { startService, clearRedis } = require('../../../config');

const stubSendCode = (service) => {
  const amqpStub = stub(service.amqp, 'publishAndWait');

  amqpStub.callThrough();
  amqpStub
    .withArgs('phone.message.predefined')
    .resolves({ queued: true });

  return amqpStub;
};

const getCodeFromStubArgs = (args) => args[1].message.replace(/\D+/g, '');

describe('update-username.update', function suite() {
  before(startService.bind(this));
  before(() => this.users.dispatch('register', {
    params: {
      activate: true,
      audience: '*.localhost',
      challengeType: 'phone',
      skipPassword: true,
      username: '19990000001',
    },
  }));
  after(clearRedis.bind(this));

  it('should be able to return error if invalid secret', async () => {
    await rejects(
      this.users.dispatch('update-username.update', {
        params: {
          token: '12345',
          username: '19990000001',
        },
      }),
      {
        code: 'E_TKN_INVALID',
        message: 'invalid token',
      }
    );
  });

  it('should be able to return error if username doesn\'t match', async () => {
    const { users } = this;
    const amqpStub = stubSendCode(users);

    await users.dispatch('update-username.request', {
      params: {
        username: '19990000001',
        value: '19990000011',
        challengeType: 'phone',
      },
    });

    const code = getCodeFromStubArgs(amqpStub.args[0]);

    amqpStub.restore();

    await rejects(
      users.dispatch('update-username.update', {
        params: {
          token: code,
          username: '19990000003',
        },
      }),
      {
        code: 'E_TKN_INVALID',
        message: 'invalid token',
      }
    );
  });

  it('should be able to return error if username already exists', async () => {
    const { users } = this;
    const amqpStub = stubSendCode(users);

    await users.dispatch('update-username.request', {
      params: {
        username: '19990000001',
        value: '19990000002',
        challengeType: 'phone',
      },
    });

    await this.users.dispatch('register', {
      params: {
        activate: false,
        audience: '*.localhost',
        challengeType: 'phone',
        skipPassword: true,
        username: '19990000002',
      },
    });

    const code = getCodeFromStubArgs(amqpStub.args[0]);

    amqpStub.restore();

    await rejects(
      users.dispatch('update-username.update', {
        params: {
          token: code,
          username: '19990000002',
        },
      }),
      {
        code: 'E_USERNAME_CONFLICT',
        message: 'user already exists',
      }
    );
  });

  it('should be able to update username', async () => {
    const { users } = this;
    const amqpStub = stubSendCode(users);

    await users.dispatch('update-username.request', {
      params: {
        username: '19990000001',
        value: '19990000003',
        challengeType: 'phone',
      },
    });

    const code = getCodeFromStubArgs(amqpStub.args[0]);

    amqpStub.restore();

    await users.dispatch('update-username.update', {
      params: {
        token: code,
        username: '19990000003',
      },
    });

    await rejects(
      users.dispatch('getMetadata', {
        params: {
          audience: '*.localhost',
          username: '19990000001',
        },
      }),
      {
        message: '"19990000001" does not exist',
      }
    );

    const newUserData = await users.dispatch('getInternalData', {
      params: {
        username: '19990000003',
      },
    });

    strictEqual(newUserData.username, '19990000003');

    const newMetadata = await users.dispatch('getMetadata', {
      params: {
        audience: '*.localhost',
        username: '19990000003',
      },
    });

    strictEqual(newMetadata['*.localhost'].username, '19990000003');
  });
});
