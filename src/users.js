const Mservice = require('@microfleet/core');
const Mailer = require('ms-mailer-client');
const merge = require('lodash/merge');
const assert = require('assert');
const fsort = require('redis-filtered-sort');
const TokenManager = require('ms-token');
const LockManager = require('dlock');
const get = require('lodash/get');
const RedisCluster = require('ioredis').Cluster;
const Flakeless = require('ms-flakeless');
const conf = require('./config');

/**
 * @namespace Users
 */
module.exports = class Users extends Mservice {
  /**
   * Configuration options for the service
   * @type {Object}
   */
  static defaultOpts = conf.get('/', { env: process.env.NODE_ENV });

  /**
   * @namespace Users
   * @param  {Object} opts
   * @return {Users}
   */
  constructor(opts = {}) {
    super(merge({}, Users.defaultOpts, opts));

    // cached ref
    const { config } = this;

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
    });

    this.on('plugin:start:http', (server) => {
      // if oAuth is enabled - initiate the strategy
      if (get(config, 'oauth.enabled', false) === true) {
        assert.equal(config.http.server.handler, 'hapi', 'oAuth must be used with hapi.js webserver');

        const OAuthStrategyHandler = require('./auth/oauth/hapi');
        this._oauth = new OAuthStrategyHandler(server, config);
      }
    });

    this.on('plugin:stop:http', () => {
      this._oauth = null;
    });

    // cleanup connections
    this.on('plugin:close:redisCluster', () => {
      this.dlock = null;
      this.tokenManager = null;
    });

    // add migration connector
    if (config.migrations.enabled === true) {
      this.addConnector(Mservice.ConnectorsTypes.migration, () => (
        this.migrate('redis', `${__dirname}/migrations`)
      ));
    }

    // adds mailer connector
    this._defineGetter('mailer');

    // pubsub connection for lock service
    this.addConnector(Mservice.ConnectorsTypes.database, () => {
      this._pubsub = new RedisCluster(config.redis.hosts, {
        ...config.redis.options,
        lazyConnect: true,
      });

      return this._pubsub.connect();
    });

    // ensure we close connection when needed
    this.addDestructor(Mservice.ConnectorsTypes.database, () => (
      this._pubsub.quit().reflect()
    ));

    // add lock manager
    this.addConnector(Mservice.ConnectorsTypes.application, () => {
      this.dlock = new LockManager({
        ...config.lockManager,
        client: this._redis,
        pubsub: this._pubsub,
        log: this.log,
      });

      return this.dlock;
    });

    // init account seed
    this.addConnector(Mservice.ConnectorsTypes.application, () => (
      this.initAdminAccounts()
    ));

    // fake accounts for development
    if (process.env.NODE_ENV === 'development') {
      this.addConnector(Mservice.ConnectorsTypes.application, () => (
        this.initFakeAccounts()
      ));
    }
  }

  /**
   * Initializes Admin accounts
   * @returns {Promise}
   */
  initAdminAccounts = require('./accounts/init-admin');

  /**
   * Initializes fake account for dev purposes
   * @returns {Promise}
   */
  initFakeAccounts = require('./accounts/init-dev');
};
