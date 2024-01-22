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
    const prepareUsers = require('../src');

    const service = this.users = await prepareUsers(testConfig);

    await this.users.register();

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
  } catch (err) {
    console.error('could not cleanup redis');
  }

  if (doNotClose !== true) {
    await service.close();
    this.users = null;
  }
}

exports.startService = startService;
exports.clearRedis = clearRedis;

exports.globalRegisterUser = registerUser;
exports.initFakeAccounts = initFakeAccounts;
exports.globalAuthUser = getJWTToken;
