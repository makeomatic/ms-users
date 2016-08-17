const path = require('path');
const schemaLessAction = require('mservice/lib/plugins/router/extensions/validate/schemaLessAction');

/**
 * Contains default options for users microservice
 * @type {Object}
 */
module.exports = {
  debug: process.env.NODE_ENV === 'development',
  // keep inactive accounts for 30 days
  deleteInactiveAccounts: 30 * 24 * 60 * 60,
  // amqp plugin configuration
  amqp: {
    transport: {
      queue: 'ms-users',
    },
    router: {
      enabled: true,
    },
  },
  router: {
    routes: {
      directory: path.join(__dirname, 'actions'),
      prefix: 'users',
      setTransportsAsDefault: true,
      transports: ['amqp'],
    },
    extensions: {
      enabled: ['postRequest'],
      register: [schemaLessAction],
    },
  },
  captcha: {
    secret: 'put-your-real-gcaptcha-secret-here',
    ttl: 3600, // 1 hour - 3600 seconds
    uri: 'https://www.google.com/recaptcha/api/siteverify',
  },
  redis: {
    options: {
      // attempt to fix cluster?
      keyPrefix: '{ms-users}',
      // pass this to constructor
      dropBufferSupport: false,
      // lazyConnect
      lazyConnect: false,
    },
    luaScripts: path.resolve(__dirname, '../scripts'),
  },
  lockManager: {
    lockPrefix: 'dlock!',
    pubsubChannel: '{ms-users}:dlock',
    lock: {
      timeout: 15000,
      retries: 1,
      delay: 50,
    },
  },
  tokenManager: {
    backend: {
      name: 'redis',
      prefix: 'tmanager!1.0.0',
    },
    encrypt: {
      algorithm: 'aes256',
      sharedSecret: 'replace-shared-secret-at-least-24-chars-long',
    },
  },
  pwdReset: {
    memorable: true,
    length: 10,
  },
  jwt: {
    defaultAudience: '*.localhost',
    hashingFunction: 'HS256',
    issuer: 'ms-users',
    secret: 'i-hope-that-you-change-this-long-default-secret-in-your-app',
    ttl: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
    lockAfterAttempts: 5,
    keepLoginAttempts: 60 * 60, // 1 hour
  },
  validation: {
    secret: {
      encrypt: true,
      type: 'uuid',
    },
    throttle: 2 * 60 * 60, // dont send emails more than once in 2 hours
    ttl: 4 * 60 * 60, // do not let password to be reset with expired codes
    paths: {
      activate: '/activate',
      reset: '/reset',
      invite: '/register',
    },
    subjects: {
      activate: 'Activate your account',
      reset: 'Reset your password',
      password: 'Account Recovery',
      register: 'Account Registration',
      invite: 'Invitation to Register',
    },
    senders: {
      activate: 'noreply <support@example.com>',
      reset: 'noreply <support@example.com>',
      password: 'noreply <support@example.com>',
      register: 'noreply <support@example.com>',
      invite: 'noreply <support@example.com>',
    },
    templates: {
      // specify template names here
    },
    email: 'support@example.com',
  },
  server: {
    proto: 'http',
    host: 'localhost',
    port: 8080,
  },
  mailer: {
    prefix: 'mailer',
    routes: {
      adhoc: 'adhoc',
      predefined: 'predefined',
    },
  },
  payments: {
    prefix: 'payments',
    routes: {
      planGet: 'plan.get',
    },
  },
  // flake id generation
  flake: {
    workerID: 0,
    outputType: 'base10',
  },
  admins: [],
  // enable all plugins
  plugins: ['validator', 'logger', 'router', 'amqp', 'redisCluster'],
  // by default only ringBuffer logger is enabled in prod
  logger: process.env.NODE_ENV === 'development',
  // init local schemas
  validator: ['../schemas'],
  // default hooks - none
  hooks: {},
  // make sure we wait for admin accounts to init
  initAdminAccountsDelay: 10000,
};
