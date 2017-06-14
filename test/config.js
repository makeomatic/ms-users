require('chai').config.includeStack = true;
const merge = require('lodash/merge');
const Promise = require('bluebird');
const { expect } = require('chai');
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
  migrations: {
  // @TODO remove
  //   enabled: true,
  //   meta: {
  //     generateUsersIds: {
  //       audiences: ['api', 'ms-files'],
  //     },
  //     referralsUsersIds: {
  //       referrals: ['cappasitycom_tutorial', 'cappasitycom', 'photigy'],
  //     },
  //   },
  // },
  },
  oauth: {
    enabled: true,
    providers: {
      facebook: {
        enabled: true,
        clientId: process.env.FACEBOOK_CLIENT_ID,
        clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
        location: 'http://localhost:3000',
        password: 'lB4wlZByzpp2R9mGefiLeaZUwVooUuX7G7uctaoeNgxvUs3W',
        apiVersion: 'v2.9',
      },
    },
  },
};

module.exports = config;

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
    })
    .then(() => {
      if (opts.locked) {
        return dispatch('users.ban', { username, ban: true });
      }

      return null;
    });
  };
}

function getJWTToken(username, password = '123') {
  return function getJWT() {
    const dispatch = simpleDispatcher(this.users.router);
    return dispatch('users.login', { username, password, audience: '*.localhost' })
      .then(({ jwt, user: { id } }) => {
        this.jwt = jwt;
        this.userId = id;
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

function startService(testConfig = {}) {
  const Users = require('../src');

  this.users = new Users(merge({}, config, testConfig));
  this.users.on('plugin:connect:amqp', () => {
    this.users._mailer = { send: () => Promise.resolve() };
  });

  return this.users.connect()
    .tap(() => {
      this.dispatch = simpleDispatcher(this.users.router);
    });
}

function initFakeAccounts() {
  return this.users.initFakeAccounts();
}

function clearRedis() {
  const nodes = this.users.redis.nodes('master');
  return Promise
    .map(nodes, node => node.flushdb())
    .reflect()
    .finally(() => this.users.close().reflect())
    .finally(() => {
      this.users = null;
      this.dispatch = null;
    });
}

global.initFakeAccounts = initFakeAccounts;
global.globalAuthUser = getJWTToken;
global.startService = startService;
global.inspectPromise = inspectPromise;
global.clearRedis = clearRedis;
global.globalRegisterUser = registerUser;
