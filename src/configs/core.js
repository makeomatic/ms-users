const path = require('path');

/**
 * Default name of the service
 * @type {String}
 */
exports.name = 'ms-users';

/**
 * Seconds to keep inactive accounts in the database
 * @type {Number} seconds - defaults to 30 days;
 */
exports.deleteInactiveAccounts = 30 * 24 * 60 * 60;

/**
 * Flake ids - sequential unique 64 bit ids
 * NOTE: this is used for JWT issue id & should be used for the
 * internal ids in the future
 * @type {Object}
 */
exports.flake = {
  workerID: 0,
  outputType: 'base10',
};

/**
 * Fill this with []<User>
 * @type {Array}
 */
exports.admins = [];

/**
 * To make some room for bringing up parts of services
 * @type {Number}
 */
exports.initAdminAccountsDelay = {
  $filter: 'env',
  test: 0,
  production: 1000,
};

/**
 * Enables plugins. This is a minimum list
 * @type {Array}
 */
exports.plugins = [
  'validator',
  'logger',
  'amqp',
  'hapi',
  'redis-cluster',
  'dlock',
  'router',
  'router-amqp',
  'router-hapi',
  'prometheus',
  'signed-request',
];

/**
 * Bunyan logger configuration
 * by default only ringBuffer logger is enabled in prod
 * @type {Boolean}
 */
exports.logger = {
  defaultLogger: process.env.NODE_ENV === 'development',
  debug: process.env.NODE_ENV === 'development',
  options: {
    redact: {
      paths: [
        'headers.cookie',
        'headers.authentication',
        'params.password',
        'params.token',
        'params.jwt',
      ],
    },
  },
};

exports.passwordValidator = {
  enabled: false,
  minStrength: 4, // 0..4
  forceCheckFieldNames: ['checkPassword'],
  skipCheckFieldNames: ['skipPassword'],
  inputFieldNames: [
    'username',
  ],
};

/**
 * Local schemas for validation
 * @type {Array}
 */
exports.validator = {
  schemas: [path.resolve(__dirname, '../../schemas')],
  ajv: {
    $meta: 'ms-validation AJV schema validator options',
    strict: true,
    strictTypes: false,
    useDefaults: true,
  },
};

/**
 * Default hooks
 * @type {Object}
 */
exports.hooks = {};

/**
 * @type {Object}
 */
exports.accessTokens = {
  secret: {
    $filter: 'env',
    $default: 'dajskd12r1987das071241d-ar-01248120d7as-d98ays',
    // NOTE: MAKE SURE TO SET THIS IN PRODUCTION
    production: '',
  },
};

/**
 * Multi-Factor Authentication Settings
 */
exports.mfa = {
  serviceName: 'microfleet.io',
  length: 40,
  check: {
    window: 10,
  },
};

/**
 * Controls if redis search is available
 */
exports.redisSearch = {
  enabled: false,
};
