const Mservice = require('mservice');
const Mailer = require('ms-mailer-client');
const Errors = require('common-errors');
const merge = require('lodash/merge');
const fsort = require('redis-filtered-sort');
const TokenManager = require('ms-token');
const LockManager = require('dlock');
const defaultOpts = require('./defaults.js');
const RedisCluster = require('ioredis').Cluster;

const { NotImplementedError } = Errors;

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

    this.on('plugin:connect:amqp', (amqp) => {
      this._mailer = new Mailer(amqp, config.mailer);
    });

    this.on('plugin:close:amqp', () => {
      this._mailer = null;
    });

    this.on('plugin:connect:redisCluster', (redis) => {
      fsort.attach(redis, 'fsort');

      // init token manager
      const tokenManagerOpts = { backend: { connection: redis } };
      this.tokenManager = new TokenManager(merge({}, config.tokenManager, tokenManagerOpts));

      // lock manager
      this.dlock = new LockManager({
        ...config.lockManager,
        // main connection
        client: redis,
        // second connection
        pubsub: new RedisCluster(config.redis.hosts, config.redis.options),
        log: this.log,
      });
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
