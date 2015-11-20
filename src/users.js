const fs = require('fs');
const path = require('path');
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
const verify = require('./actions/verify.js');
const requestPassword = require('./actions/requestPassword.js');
const updatePassword = require('./actions/updatePassword.js');
const ban = require('./actions/ban.js');
const list = require('./actions/list.js');

// utils
const redisKey = require('./utils/key.js');
const sortedFilteredListLua = fs.readFileSync(path.resolve(__dirname, '../lua/sorted-filtered-list.lua'), 'utf-8');

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
    // prefix routes with users.
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

      // lists and iterators over registered users
      list: 'list',
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
        // must have {}, so that the keys end up on a single machine
        keyPrefix: '{ms-users}',
      },
      userSet: 'user-iterator-set'
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
      senders: {
        activate: 'noreply <support@example.com>',
        reset: 'noreply <support@example.com>',
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
    admins: []
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

    const { error } = validateSync('config', config);
    if (error) {
      this.log.fatal('Invalid configuration:', error.toJSON());
      throw error;
    }
  }

  initAdminAccounts() {
    const accounts = this._config.admins;
    const audience = this._config.jwt.defaultAudience;
    return Promise.map(accounts, (account) => {
      return register.call(this, {
        username: account.username,
        password: account.password,
        audience,
        metadata: {
          firstName: account.firstName,
          lastName: account.lastName,
          roles: [ 'admin' ],
        },
        activate: true,
      })
      .reflect();
    })
    .bind(this)
    .then(function reportStats(users) {
      const totalAccounts = users.length;
      const errors = [];
      let registered = 0;
      users.forEach(user => {
        if (user.isFulfilled()) {
          registered++;
        } else {
          errors.push(user.reason());
        }
      });

      this.log.info('Registered admins %d/%d. Errors:', registered, totalAccounts, errors);
    })
    .finally(() => {
      this.log.info('removing account references from memory');
      this._config.admins = [];
    });
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
    const time = process.hrtime();
    const route = headers.routingKey.split('.').pop();
    const defaultRoutes = Users.defaultOpts.postfix;
    const { postfix } = this._config;

    let promise;
    switch (route) {
    case postfix.verify:
      promise = this._validate(defaultRoutes.verify, message).then(this._verify);
      break;
    case postfix.register:
      promise = this._validate(defaultRoutes.register, message).then(this._register);
      break;
    case postfix.ban:
      promise = this._validate(defaultRoutes.ban, message).then(this._ban);
      break;
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
      promise = this._validate(defaultRoutes.updateMetadata, message).then(this._updateMetadata);
      break;
    case postfix.requestPassword:
      promise = this._validate(defaultRoutes.requestPassword, message).then(this._requestPassword);
      break;
    case postfix.updatePassword:
      promise = this._validate(defaultRoutes.updatePassword, message).then(this._updatePassword);
      break;
    case postfix.list:
      promise = this._validate(defaultRoutes.list, message).then(this._list);
      break;
    default:
      promise = Promise.reject(new Errors.NotImplementedError(fmt('method "%s"', route)));
      break;
    }

    // if we have an error
    promise.finally(function auditLog(response) {
      const execTime = process.hrtime(time);
      const meta = {
        message,
        headers,
        latency: hrend[0] * 1000 + (+(hrend[1]/1000000).toFixed(3)),
      };

      if (response instanceof Error) {
        this.log.error(meta, 'Error performing operation', err);
      } else {
        this.log.info(meta, 'completed operation');
      }
    });

    if (typeof next === 'function') {
      return promise.asCallback(next);
    }

    return promise;
  }

  /**
   * @private
   * @param  {String} route
   * @param  {Object} message
   * @return {Promise}
   */
  _validate(route, message) {
    return validate(route, message)
      .bind(this)
      .return(message)
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
  _list(message) {
    return list.call(this, message);
  }

  /**
   * @private
   * @param  {Object} message
   * @return {Promise}
   */
  _ban(message) {
    return ban.call(this, message);
  }

  /**
   * @private
   * @param  {Object} message
   * @return {Promise}
   */
  _updatePassword(message) {
    return updatePassword.call(this, message);
  }

  /**
   * @private
   * @param  {Object} message
   * @return {Promise}
   */
  _requestPassword(message) {
    return requestPassword.call(this, message);
  }

  /**
   * @private
   * @param  {Object} message
   * @return {Promise}
   */
  _verify(message) {
    return verify.call(this, message);
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
    const { username } = message;
    return this._redis
      .hexists(redisKey(username, 'data'), 'password')
      .then((exists) => {
        if (exists !== true) {
          throw new Errors.HttpStatusError(404, `"${username}" does not exists`);
        }

        return getMetadata.call(this, username, message.audience);
      });
  }

  /**
   * @private
   * @param  {Object}  message
   * @return {Promise}
   */
  _updateMetadata(message) {
    const { username } = message;
    return this._redis
      .hexists(redisKey(username, 'data'), 'password')
      .then((exists) => {
        if (exists !== true) {
          throw new Errors.HttpStatusError(404, `"${username}" does not exists`);
        }

        return updateMetadata.call(this, message);
      });
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
      instance.defineCommand('sortedFilteredList', {
        numberOfKeys: 2,
        lua: sortedFilteredListLua,
      })
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
