const AMQPTransport = require('ms-amqp-transport');
const Validation = require('ms-amqp-validation');
const Mailer = require('ms-mailer-client');
const Promise = require('bluebird');
const Errors = require('common-errors');
const EventEmitter = require('eventemitter3');
const ld = require('lodash');
const redis = require('ioredis');
const { format: fmt } = require('util');
const bunyan = require('bunyan');

// validator configuration
const { validate, validateSync } = new Validation('../schemas');

// actions
const register = require('./actions/register.js');
const getMetadata = require('./actions/getMetadata.js');
const updateMetadata = require('./actions/updateMetadata.js');
const challenge = require('./actions/challenge.js');
const activate = require('./actions/activate.js');
const login = require('./actions/login.js');
const logout = require('./actions/logout.js');

/**
 * @namespace Users
 */
module.exports = class Users extends EventEmitter {

  /**
   * Configuration options for the service
   * @type {Object}
   */
  static defaultOpts = {
    debug: process.env.NODE_ENV === 'development',
    prefix: 'users',
    // keep inactive accounts for 30 days
    deleteInactiveAccounts: 30 * 24 * 60 * 60,
    // postfixes for routes that we support
    postfix: {
      // ban, supports both unban/ban actions
      ban: 'ban',

      // challenge. Challenge sends email with a token that is used to activate account
      // often used internally from 'register' method
      challenge: 'challenge',

      // verifies it and activates not banned account
      activate: 'activate',

      // verify token and return metadata
      verify: 'verify',

      // verify credentials and return metadata
      login: 'login',

      // verify token and destroy it
      logout: 'logout',

      // creates new user
      // sends 'challenge', or, if this options is not set, immediately registers user
      // in the future multiple challenge options could be supported, for now it's just an email
      register: 'register',

      // pass metadata out based on username
      // core data only contains username and hashed password
      // this is an application specific part that can store anything here
      getMetadata: 'getMetadata',

      // update metadata based on username
      // rewrites/adds new data, includes both set and remove methods, set overwrites,
      // while remove - deletes. Set precedes over remove and batch updates are supported
      updateMetadata: 'updateMetadata',

      // requests an email to change password
      // can be extended in the future to support more options like secret questions
      // or text messages
      requestPassword: 'requestPassword',

      // updates password - either without any checks or, if challenge token is passed, makes sure it's correct
      updatePassword: 'updatePassword',
    },
    amqp: {
      queue: 'ms-users',
    },
    captcha: {
      secret: 'put-your-real-gcaptcha-secret-here',
      ttl: 3600, // 1 hour - 3600 seconds
      uri: 'https://www.google.com/recaptcha/api/siteverify',
    },
    redis: {
      options: {
        keyPrefix: '{ms-users}',
      },
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
      secret: 'please-replace-this-as-a-long-nice-secret',
      algorithm: 'aes-256-ctr',
      throttle: 2 * 60 * 60, // dont send emails more than once in 2 hours
      ttl: 4 * 60 * 60, // do not let password to be reset with expired codes
      paths: {
        activate: '/activate',
        reset: '/reset',
      },
      subjects: {
        activate: 'Activate your account',
        reset: 'Reset your password',
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
  };

  /**
   * @namespace Users
   * @param  {Object} opts
   * @return {Users}
   */
  constructor(opts = {}) {
    super();
    const config = this._config = ld.merge({}, Users.defaultOpts, opts);

    // map routes we listen to
    const { prefix } = config;
    config.amqp.listen = ld.map(config.postfix, function assignPostfix(postfix) {
      return `${prefix}.${postfix}`;
    });

    // define logger
    this.setLogger();

    const err = validateSync('config', config);
    if (err) {
      this.log.fatal('Invalid configuration:', err.toJSON());
      throw err;
    }
  }

  /**
   * Set logger
   */
  setLogger() {
    const config = this._config;
    let { logger } = config;
    if (!config.hasOwnProperty('logger')) {
      logger = config.debug;
    }

    // define logger
    if (logger && logger instanceof bunyan) {
      this.log = logger;
    } else {
      let stream;
      if (logger) {
        stream = {
          stream: process.stdout,
          level: config.debug ? 'debug' : 'info',
        };
      } else {
        stream = {
          level: 'trace',
          type: 'raw',
          stream: new bunyan.RingBuffer({ limit: 100 }),
        };
      }
      this.log = bunyan.createLogger({
        name: 'ms-users',
        streams: [ stream ],
      });
    }
  }

  /**
   * Router instance, bound to Users module
   * @param  {Object}   message
   * @param  {Object}   headers
   * @param  {Object}   actions
   * @param  {Function} next
   * @return {Promise}
   */
  router = (message, headers, actions, next) => {
    const route = headers.routingKey.split('.').pop();
    const defaultRoutes = Users.defaultOpts.postfix;
    const { postfix } = this._config;

    let promise;
    switch (route) {
    case postfix.verify:
    case postfix.register:
      promise = this._validate(defaultRoutes.register, message).then(this._register);
      break;
    case postfix.ban:
    case postfix.challenge:
      promise = this._validate(defaultRoutes.challenge, message).then(this._challenge);
      break;
    case postfix.activate:
      promise = this._validate(defaultRoutes.activate, message).then(this._activate);
      break;
    case postfix.login:
      promise = this._validate(defaultRoutes.login, message).then(this._login);
      break;
    case postfix.logout:
      promise = this._validate(defaultRoutes.logout, message).then(this._logout);
      break;
    case postfix.getMetadata:
      promise = this._validate(defaultRoutes.getMetadata, message).then(this._getMetadata);
      break;
    case postfix.updateMetadata:
      promise = this._validate(defaultRoutes.getMetadata, message).then(this._setMetadata);
      break;
    case postfix.requestPassword:
    case postfix.updatePassword:
    default:
      promise = Promise.reject(new Errors.NotImplementedError(fmt('method "%s"', route)));
      break;
    }

    // if we have an error
    promise.catch(function reportError(err) {
      this.log.error('Error performing %s operation', route, err);
    });

    if (typeof next === 'function') {
      return promise.asCallback(next);
    }

    return promise;
  }

  _validate(route, message) {
    return validate(route, message)
      .bind(this)
      .catch(function validationError(error) {
        this.log.warn('Validation error:', error.toJSON());
        throw error;
      });
  }

  /**
   * @private
   * @param  {Object} message
   * @return {Promise}
   */
  _logout(message) {
    return logout.call(this, message);
  }

  /**
   * @private
   * @param  {Object} message
   * @return {Promise}
   */
  _login(message) {
    return login.call(this, message);
  }

  /**
   * @private
   * @param  {Object} message
   * @return {Promise}
   */
  _activate(message) {
    return activate.call(this, message);
  }

  /**
   * @private
   * @param  {Object} message
   * @return {Promise}
   */
  _challenge(message) {
    return challenge.call(this, message);
  }

  /**
   * @private
   * @param  {Object} message
   * @return {Promise}
   */
  _register(message) {
    return register.call(this, message);
  }

  /**
   * @private
   * @param  {Object} message
   * @return {Promise}
   */
  _getMetadata(message) {
    return getMetadata.call(this, message.username, message.audience);
  }

  /**
   * @private
   * @param  {Object}  message
   * @return {Promise}
   */
  _updateMetadata(message) {
    return updateMetadata.call(this, message);
  }

  /**
   * @private
   * @return {Promise}
   */
  _connectRedis() {
    if (this._redis) {
      return Promise.reject(new Errors.NotPermittedError('redis was already started'));
    }

    const config = this._config.redis;
    return new Promise(function redisClusterConnected(resolve, reject) {
      let onReady;
      let onError;

      const instance = new redis.Cluster(config.hosts, config.options || {});

      onReady = function redisConnect() {
        instance.removeListener('error', onError);
        resolve(instance);
      };

      onError = function redisError(err) {
        instance.removeListener('ready', onReady);
        reject(err);
      };

      instance.once('ready', onReady);
      instance.once('error', onError);
    })
    .tap((instance) => {
      this._redis = instance;
    });
  }

  /**
   * @private
   * @return {Promise}
   */
  _closeRedis() {
    if (!this._redis) {
      return Promise.reject(new Errors.NotPermittedError('redis was not started'));
    }

    return this._redis
      .quit()
      .tap(() => {
        this._redis = null;
      });
  }

  /**
   * @private
   * @return {Promise}
   */
  _connectAMQP() {
    if (this._amqp) {
      return Promise.reject(new Errors.NotPermittedError('amqp was already started'));
    }

    return AMQPTransport
      .connect(this._config.amqp, this.router)
      .tap((amqp) => {
        this._amqp = amqp;
        this._mailer = new Mailer(amqp, this._config.mailer);
      })
      .catch((err) => {
        this.log.fatal('Error connecting to AMQP', err.toJSON());
        throw err;
      });
  }

  /**
   * @private
   * @return {Promise}
   */
  _closeAMQP() {
    if (!this._amqp) {
      return Promise.reject(new Errors.NotPermittedError('amqp was not started'));
    }

    return this._amqp
      .close()
      .tap(() => {
        this._amqp = null;
        this._mailer = null;
      });
  }

  /**
   * @return {Promise}
   */
  connect() {
    return Promise.all([
      this._connectAMQP(),
      this._connectRedis(),
    ])
    .return(this);
  }

  /**
   * @return {Promise}
   */
  close() {
    return Promise.all([
      this._closeAMQP(),
      this._closeRedis(),
    ]);
  }

};
