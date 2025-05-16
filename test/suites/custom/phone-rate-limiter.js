const { rejects } = require('node:assert');
const { setTimeout } = require('node:timers/promises');
const { stub } = require('sinon');

const { phoneChallengeRateLimiter } = require('../../../src/custom/phone-rate-limiter');

const { startService, clearRedis } = require('../../config');

describe('phone-rate-limiter', function suite() {
  beforeEach(() => startService.call(this, {
    router: {
      extensions: {
        register: [
          phoneChallengeRateLimiter,
        ],
      },
    },
    rateLimiters: {
      phoneChallengeTotal: {
        windowInterval: 1000 * 60 * 60 * 1, // 1h
        windowLimit: 20,
        blockInterval: 1000 * 60 * 60 * 1, // 1h
      },
      phoneChallengeLock: {
        limitIp: {
          windowInterval: 1000 * 60 * 30, // 30m
          windowLimit: 15,
          blockInterval: 1000 * 60 * 30, // 30m
        },
        limitKeyIp: {
          windowInterval: 1000 * 60 * 30, // 30m
          windowLimit: 10,
          blockInterval: 1000 * 60 * 30, // 30m
        },
      },
      phoneChallengeCaptcha: {
        limitIp: {
          windowInterval: 1000 * 60 * 10, // 10m
          windowLimit: 5,
          blockInterval: 1000 * 60 * 10, // 10m
        },
        limitKeyIp: {
          windowInterval: 1000 * 60 * 10, // 10m
          windowLimit: 3,
          blockInterval: 1000 * 60 * 10, // 10m
        },
      },
    },
    token: {
      phone: {
        throttle: 1,
      },
    },
  }));
  beforeEach(() => this.users.dispatch('register', {
    params: {
      activate: true,
      audience: '*.localhost',
      challengeType: 'phone',
      ipaddress: '127.0.0.1',
      skipPassword: true,
      username: '19990000001',
    },
  }));
  afterEach(clearRedis.bind(this));

  it('update-username.request should be able to return error if captcha required (limit by ip)', async () => {
    const amqpStub = stub(this.users.amqp, 'publishAndWait');
    const requestPromises = [];

    amqpStub.callThrough();
    amqpStub
      .withArgs('phone.message.predefined')
      .resolves({ queued: true });

    for (let i = 0; i < 5; i += 1) {
      requestPromises.push(
        this.users.amqp.publishAndWait('users.update-username.request', {
          challengeType: 'phone',
          remoteip: '127.0.0.1',
          username: '19990000001',
          value: `199900000${i}0`,
        })
      );
    }

    await Promise.all(requestPromises);

    await rejects(
      this.users.amqp.publishAndWait('users.update-username.request', {
        challengeType: 'phone',
        remoteip: '127.0.0.1',
        username: '19990000001',
        value: '19990000050',
      }),
      {
        code: 'E_CAPTCHA_REQUIRED',
        message: 'Captcha required',
      }
    );

    amqpStub.restore();
  });

  it('update-username.request should be able to return error if captcha required (limit by phone and ip)', async () => {
    const amqpStub = stub(this.users.amqp, 'publishAndWait');

    amqpStub.callThrough();
    amqpStub
      .withArgs('phone.message.predefined')
      .resolves({ queued: true });

    for (let i = 0; i < 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await this.users.amqp.publishAndWait('users.update-username.request', {
        challengeType: 'phone',
        remoteip: '127.0.0.1',
        username: '19990000001',
        value: '19990000050',
      });
      // eslint-disable-next-line no-await-in-loop
      await setTimeout(1500);
    }

    await rejects(
      this.users.amqp.publishAndWait('users.update-username.request', {
        challengeType: 'phone',
        remoteip: '127.0.0.1',
        username: '19990000001',
        value: '19990000050',
      }),
      {
        code: 'E_CAPTCHA_REQUIRED',
        message: 'Captcha required',
      }
    );

    amqpStub.restore();
  });
});
