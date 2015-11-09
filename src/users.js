const AMQPTransport = require('ms-amqp-transport');
const Validation = require('ms-amqp-validation');
const Promise = require('bluebird');
const Errors = require('common-errors');
const EventEmitter = require('eventemitter3');
const ld = require('lodash');
const path = require('path');
const { format: fmt } = require('util');

// validator configuration
const { validate } = new Validation(path.resolve(__dirname, './schemas'));

module.exports = class Users extends EventEmitter {

  /**
   * Configuration options for the service
   * @type {Object}
   */
  static defaultOpts = {
    debug: process.env.NODE_ENV === 'development',
    prefix: 'users',
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
  };

  /**
   * @namespace Users
   * @param  {Object} opts
   * @return {Users}
   */
  constructor(opts = {}) {
    super();
    const config = this._config = ld.merge({}, Users.defaultOptions, opts);

    // map routes we listen to
    const { prefix } = config;
    config.amqp.listen = ld.map(config.postfix, function assignPostfix(postfix) {
      return `${prefix}.${postfix}`;
    });
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
    const { postfix } = this._config;

    let promise;
    switch (route) {
    case postfix.ban:
    case postfix.challenge:
    case postfix.activate:
    case postfix.verify:
    case postfix.login:
    case postfix.logout:
    case postfix.register:
    case postfix.getMetadata:
    case postfix.updateMetadata:
    case postfix.requestPassword:
    case postfix.updatePassword:
    default:
      promise = Promise.reject(new Errors.NotImplementedError(fmt('method "%s"', route)));
      break;
    }

    if (typeof next === 'function') {
      return promise.asCallback(next);
    }

    return promise;
  }

  connect() {
    if (this._amqp) {
      return Promise.reject(new Errors.NotPermittedError('service was already started'));
    }

    const config = this._config;

    return validate('config', config)
      .then(() => {
        return AMQPTransport.connect(config, this.router)
        .tap((amqp) => {
          this._amqp = amqp;
        });
      })
      .return(this);
  }

  close() {
    if (!this._amqp) {
      return Promise.reject(new Errors.NotPermittedError('service is not online'));
    }

    return this._amqp
      .close()
      .tap(() => {
        this._amqp = null;
      });
  }

};
