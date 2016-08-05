require('chai').config.includeStack = true;
const { expect } = require('chai');
const simpleDispatcher = require('./helpers/simpleDispatcher');

global.Promise = require('bluebird');

global.REDIS = {
  hosts: Array.from({ length: 3 }).map((_, i) => ({
    host: `redis-${i + 1}`,
    port: 6379,
  })),
};

const config = {
  amqp: {
    transport: {
      connection: {
        host: 'rabbitmq',
        port: 5672,
      },
    },
  },
  redis: global.REDIS,
  logger: true,
  debug: true,
  validation: {
    templates: {
      activate: 'cappasity-activate',
      password: 'cappasity-password',
      register: 'cappasity-register',
      invite: 'rfx-invite',
    },
  },
  registrationLimits: {
    ip: {
      times: 3,
      time: 3600000,
    },
    noDisposable: true,
    checkMX: true,
  },
};

function registerUser(username, opts = {}) {
  return function register() {
    const dispatch = simpleDispatcher(this.users.router);

    return dispatch('users.register', {
      username,
      password: '123',
      audience: '*.localhost',
      activate: !opts.inactive,
      skipChallenge: true,
      metadata: opts.metadata || undefined,
    }).then(() => {
      if (opts.locked) {
        return dispatch('users.ban', { username, ban: true });
      }

      return null;
    });
  };
}

function inspectPromise(mustBeFulfilled = true) {
  return function inspection(promise) {
    const isFulfilled = promise.isFulfilled();
    const isRejected = promise.isRejected();

    try {
      expect(isFulfilled).to.be.eq(mustBeFulfilled);
    } catch (e) {
      if (isFulfilled) {
        return Promise.reject(new Error(JSON.stringify(promise.value())));
      }

      throw promise.reason();
    }

    expect(isRejected).to.be.eq(!mustBeFulfilled);
    return mustBeFulfilled ? promise.value() : promise.reason();
  };
}

function startService() {
  const Users = require('../src');

  this.users = new Users(config);
  this.users.on('plugin:connect:amqp', () => {
    this.users._mailer = { send: () => Promise.resolve() };
  });

  return this.users.connect();
}

function clearRedis() {
  const nodes = this.users.redis.nodes('master');
  return Promise
    .map(nodes, node => node.flushdb())
    .reflect()
    .finally(() => this.users.close().reflect())
    .finally(() => {
      this.users = null;
    });
}

global.startService = startService;
global.inspectPromise = inspectPromise;
global.clearRedis = clearRedis;
global.globalRegisterUser = registerUser;
