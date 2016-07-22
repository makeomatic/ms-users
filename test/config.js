require('chai').config.includeStack = true;
const { expect } = require('chai');

global.Promise = require('bluebird');

global.AMQP = {
  connection: {
    host: 'rabbitmq',
    port: 5672,
  },
};

global.REDIS = {
  hosts: Array.from({ length: 3 }).map((_, i) => ({
    host: `redis-${i + 1}`,
    port: 6379,
  })),
};

const config = {
  amqp: {
    transport: global.AMQP
  },
  redis: global.REDIS,
  logger: true,
  debug: true,
  validation: {
    templates: {
      activate: 'cappasity-activate',
      password: 'cappasity-password',
      register: 'cappasity-register',
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
    return this.users
      .router({
        username,
        password: '123',
        audience: '*.localhost',
        activate: !opts.inactive,
        skipChallenge: true,
        metadata: opts.metadata || undefined,
      }, { routingKey: 'users.register' })
      .then(() => {
        if (opts.locked) {
          return this.users.router({ username, ban: true }, { routingKey: 'users.ban' });
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
  .finally(() => this.users.close())
  .finally(() => {
    this.users = null;
  });
}

global.startService = startService;
global.inspectPromise = inspectPromise;
global.clearRedis = clearRedis;
global.globalRegisterUser = registerUser;
