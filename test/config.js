require('chai').config.includeStack = true;
const merge = require('lodash/merge');
const Promise = require('bluebird');
const simpleDispatcher = require('./helpers/simpleDispatcher');

global.Promise = Promise;

global.REDIS = {
  hosts: Array.from({ length: 3 }).map((_, i) => ({
    host: 'redis',
    port: 7000 + i,
  })),
};

global.AMQP_OPTS = {
  transport: {
    connection: {
      host: 'rabbitmq',
      port: 5672,
    },
  },
};

const config = {
  amqp: global.AMQP_OPTS,
  redis: global.REDIS,
  logger: {
    defaultLogger: true,
    debug: true,
  },
  validation: {
    templates: {
      activate: 'cpst-activate',
      password: 'cpst-password',
      register: 'cpst-register',
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
  phone: {
    account: 'twilio',
    waitChallenge: true,
  },
  oauth: {
    enabled: true,
    providers: {
      facebook: {
        enabled: true,
        clientId: process.env.FACEBOOK_CLIENT_ID,
        clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
        location: 'http://ms-users.local:3000',
        password: 'lB4wlZByzpp2R9mGefiLeaZUwVooUuX7G7uctaoeNgxvUs3W',
        apiVersion: 'v2.9',
      },
    },
  },
  jwt: {
    cookies: {
      enabled: true,
    },
  },
};

module.exports = config;

function registerUser(username, opts = {}) {
  return async function register() {
    const srv = this.service || this.users;
    await srv.dispatch('register', {
      params: {
        username,
        password: '123',
        audience: '*.localhost',
        activate: !opts.inactive,
        skipChallenge: true,
        metadata: opts.metadata || undefined,
      },
    });

    if (opts.locked) {
      return srv.dispatch('ban', { params: { username, ban: true } });
    }

    return null;
  };
}

function getJWTToken(username, password = '123') {
  return async function getJWT() {
    const { jwt, user } = await (this.service || this.users).dispatch('login', {
      params: { username, password, audience: '*.localhost' },
    });

    this.jwt = jwt;
    this.userId = user.id;
  };
}

async function startService(testConfig = {}) {
  try {
    const Users = require('../src');

    this.users = new Users(merge({}, config, testConfig));
    this.users.on('plugin:connect:amqp', () => {
      this.users._mailer = { send: () => Promise.resolve() };
    });

    const service = await this.users.connect();
    this.dispatch = simpleDispatcher(this.users.router);
    return service;
  } catch (e) {
    console.error('failed to start', e);
    throw e;
  }
}

function initFakeAccounts() {
  return this.users.initFakeAccounts();
}

async function clearRedis() {
  const nodes = this.users.redis.nodes('master');
  return Promise
    .map(nodes, node => node.flushdb().reflect())
    .finally(() => this.users.close().reflect())
    .finally(() => {
      this.users = null;
      this.dispatch = null;
    });
}

global.initFakeAccounts = initFakeAccounts;
global.globalAuthUser = getJWTToken;
global.startService = startService;
global.clearRedis = clearRedis;
global.globalRegisterUser = registerUser;
