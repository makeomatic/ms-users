require('chai').config.includeStack = true;
const { expect } = require('chai');
const Users = require('../lib');

global.Promise = require('bluebird');

global.AMQP = {
  connection: {
    host: process.env.RABBITMQ_PORT_5672_TCP_ADDR,
    port: process.env.RABBITMQ_PORT_5672_TCP_PORT,
  },
};

global.REDIS = {
  hosts: [
    {
      host: process.env.REDIS_1_PORT_6379_TCP_ADDR,
      port: process.env.REDIS_1_PORT_6379_TCP_PORT,
    },
    {
      host: process.env.REDIS_2_PORT_6379_TCP_ADDR,
      port: process.env.REDIS_2_PORT_6379_TCP_PORT,
    },
    {
      host: process.env.REDIS_3_PORT_6379_TCP_ADDR,
      port: process.env.REDIS_3_PORT_6379_TCP_PORT,
    },
  ],
};

const config = {
  amqp: global.AMQP,
  redis: global.REDIS,
  validation: {
    templates: {
      activate: 'cappasity-activate',
      password: 'cappasity-password',
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
  this.users = new Users(config);
  this.users.on('plugin:connect:amqp', () => {
    this.users._mailer = { send: () => Promise.resolve() };
  });

  return this.users.connect();
}

function clearRedis() {
  const nodes = this.users._redis.masterNodes;
  return Promise.map(Object.keys(nodes), nodeKey => {
    return nodes[nodeKey].flushdb();
  })
  .finally(() => {
    return this.users.close();
  })
  .finally(() => {
    this.users = null;
  });
}

global.startService = startService;
global.inspectPromise = inspectPromise;
global.clearRedis = clearRedis;
