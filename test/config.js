const Promise = require('bluebird');

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

    const service = this.users = new Users(testConfig);
    this.users.on('plugin:connect:amqp', () => {
      this.users._mailer = { send: () => Promise.resolve() };
    });

    await this.users.connect();
    return service;
  } catch (e) {
    console.error('failed to start', e);
    throw e;
  }
}

function initFakeAccounts() {
  return this.users.initFakeAccounts();
}

async function clearRedis(doNotClose = false) {
  const service = this.users;

  try {
    if (service.redisType === 'redisCluster') {
      await Promise.map(service.redis.nodes('master'), (node) => (
        node.flushdb()
      ));
    } else {
      await service.redis.flushdb();
    }
  } finally {
    if (doNotClose === false) {
      await service.close();
      this.users = null;
    }
  }
}

global.initFakeAccounts = initFakeAccounts;
global.globalAuthUser = getJWTToken;
global.startService = startService;
global.clearRedis = clearRedis;
global.globalRegisterUser = registerUser;
