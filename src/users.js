const Mservice = require('mservice');
const Mailer = require('ms-mailer-client');
const Errors = require('common-errors');
const merge = require('lodash/merge');
const fsort = require('redis-filtered-sort');
const { NotImplementedError } = Errors;
const defaultOpts = require('./defaults.js');

/**
 * @namespace Users
 */
module.exports = class Users extends Mservice {

  /**
   * Configuration options for the service
   * @type {Object}
   */
  static defaultOpts = defaultOpts;

  /**
   * @namespace Users
   * @param  {Object} opts
   * @return {Users}
   */
  constructor(opts = {}) {
    super(merge({}, Users.defaultOpts, opts));
    const config = this.config;

    const { error } = this.validateSync('config', config);
    if (error) {
      this.log.fatal('Invalid configuration:', error.toJSON());
      throw error;
    }
//повесить логику выбора адаптера можно повесить сюда, экшн долежн выполниться позже, можно лочить принятие сообщений внутри роута
    this.on('plugin:connect:amqp', (amqp) => {
      this._mailer = new Mailer(amqp, config.mailer);
    });

    this.on('plugin:close:amqp', () => {
      this._mailer = null;
    });

    this.on('plugin:connect:redisCluster', (redis) => {
      fsort.attach(redis, 'fsort');
    });
  }

  /**
   * Getter for mailer client
   * @return {Object}
   */
  get mailer() {
    const mailer = this._mailer;
    return mailer || this.emit('error', new NotImplementedError('amqp is not connected'));
  }

  /**
   * Getter for configuration
   * @return {Object}
   */
  get config() {
    return this._config;

  }

  /**
   * Initializes Admin accounts
   * @return {Promise}
   */
  initAdminAccounts = require('./accounts/init-admin.js');

  /**
   * Initializes fake account for dev purposes
   * @return {Promise}
   */
  initFakeAccounts = require('./accounts/init-dev.js');

};

