const { rejects, strictEqual } = require('node:assert');
const { stub } = require('sinon');
const { authenticator } = require('otplib');

const { startService, clearRedis } = require('../../../config');

describe('update-username.request', function suite() {
  let mfaSecret;

  beforeEach(startService.bind(this));
  beforeEach(() => this.users.dispatch('register', {
    params: {
      activate: true,
      audience: '*.localhost',
      challengeType: 'phone',
      skipPassword: true,
      username: '19990000001',
    },
  }));
  beforeEach(() => this.users.dispatch('register', {
    params: {
      activate: true,
      audience: '*.localhost',
      challengeType: 'phone',
      skipPassword: true,
      username: '19990000002',
    },
  }));
  afterEach(clearRedis.bind(this));

  it('should be able to return error if invalid phone', async () => {
    await rejects(
      this.users.amqp.publishAndWait('users.update-username.request', {
        username: '19990000001',
        value: 'foo@bar.com',
        challengeType: 'phone',
      }),
      /data\/value must match pattern "\^\[0-9]\{7,15}\$"/
    );
  });

  it('should be able to return error if username already exists', async () => {
    await rejects(
      this.users.dispatch('update-username.request', {
        params: {
          username: '19990000001',
          value: '19990000002',
          challengeType: 'phone',
        },
      }),
      {
        code: 'E_USERNAME_CONFLICT',
        message: 'user already exists',
      }
    );
  });

  it('should be able to request username update', async () => {
    const amqpStub = stub(this.users.amqp, 'publishAndWait');

    amqpStub.callThrough();
    amqpStub
      .withArgs('phone.message.predefined')
      .resolves({ queued: true });

    const response = await this.users.amqp.publishAndWait('users.update-username.request', {
      username: '19990000001',
      value: '19990000003',
      challengeType: 'phone',
    });

    const args = amqpStub.args[1];
    const action = args[0];
    const message = args[1];

    strictEqual(action, 'phone.message.predefined');
    strictEqual(message.account, 'twilio');
    strictEqual(/\d{4} is your code for update username/.test(message.message), true);
    strictEqual(message.to, '+19990000003');

    strictEqual(typeof response.uid, 'string');

    amqpStub.restore();
  });

  it('should be able to return error if invalid mfa', async () => {
    const { users } = this;

    const mfaData = await users.dispatch('mfa.generate-key', {
      params: {
        username: '19990000001',
        time: Date.now(),
      },
    });

    mfaSecret = mfaData.secret;

    await users.dispatch('mfa.attach', {
      params: {
        username: '19990000001',
        secret: mfaSecret,
        totp: authenticator.generate(mfaSecret),
      },
    });

    await rejects(
      this.users.amqp.publishAndWait('users.update-username.request', {
        username: '19990000001',
        value: '19990000003',
        challengeType: 'phone',
      }),
      {
        code: 'E_TOTP_REQUIRED',
        message: 'TOTP required',
      }
    );
  });
});
