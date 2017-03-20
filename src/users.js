const Promise = require('bluebird');
const Mservice = require('mservice');
const Mailer = require('ms-mailer-client');
const Errors = require('common-errors');
const merge = require('lodash/merge');
const fsort = require('redis-filtered-sort');
const TokenManager = require('ms-token');
const LockManager = require('dlock');
const RedisCluster = require('ioredis').Cluster;
const Flakeless = require('ms-flakeless');
const defaultOpts = require('./config');
const { OauthHandler } = require('./utils/oauth');

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

    // id generator
    this.flake = new Flakeless(config.flake);

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

      // run migrations
      this.migrate('redis', `${__dirname}/migrations`);
    });

    this.on('plugin:start:http', (server) => {
      this._oauth = new OauthHandler(server, config);
    });

    this.on('plugin:stop:http', () => {
      this._oauth = null;
    });

    // cleanup connections
    this.on('plugin:close:redisCluster', () => {
      this.dlock = null;
      this.tokenManager = null;
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
   * Gracefully connect to cluster
   * @return {Promise}
   */
  connect() {
    const config = this.config;
    this._pubsub = new RedisCluster(config.redis.hosts, {
      ...config.redis.options,
      lazyConnect: true,
    });

    return Promise
      .join(super.connect(), this._pubsub.connect())
      .tap(() => {
        // lock manager
        this.dlock = new LockManager({
          ...config.lockManager,
          client: this._redis,
          pubsub: this._pubsub,
          log: this.log,
        });
      });
  }

  /**
   * Gracefully disconnect from the cluster
   * @return {Promise}
   */
  close() {
    return Promise
      .join(super.close(), this._pubsub.quit().reflect());
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
