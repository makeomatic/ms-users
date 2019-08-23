const { Microfleet, ConnectorsTypes } = require('@microfleet/core');
const Mailer = require('ms-mailer-client');
const merge = require('lodash/merge');
const assert = require('assert');
const fsort = require('redis-filtered-sort');
const TokenManager = require('ms-token');
const LockManager = require('dlock');
const RedisCluster = require('ioredis').Cluster;
const Flakeless = require('ms-flakeless');
const conf = require('./config');
const get = require('./utils/get-value');

/**
 * @namespace Users
 */
module.exports = class Users extends Microfleet {
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
    const { prefix } = config.router.routes;

    /**
     * Setup data for bearer token authentication
     * @type {Object}
     */
    config.users = {
      audience: config.jwt.defaultAudience,
      verify: `${prefix}.verify`,
      timeouts: {
        verify: 5000,
      },
    };

    // 2 different plugin types
    let redisDuplicate;
    if (config.plugins.includes('redisCluster')) {
      this.redisType = 'redisCluster';
      redisDuplicate = () => new RedisCluster(config.redis.hosts, {
        ...config.redis.options,
        lazyConnect: true,
      });
    } else if (config.plugins.includes('redisSentinel')) {
      this.redisType = 'redisSentinel';
      redisDuplicate = (redis) => redis.duplicate();
    } else {
      throw new Error('must include redis family plugins');
    }

    // id generator
    this.flake = new Flakeless(config.flake);

    this.on('plugin:connect:amqp', (amqp) => {
      this.mailer = new Mailer(amqp, config.mailer);
    });

    this.on('plugin:close:amqp', () => {
      this.mailer = null;
    });

    this.on(`plugin:connect:${this.redisType}`, (redis) => {
      const inactiveUsers = require('./utils/inactiveUsers');
      fsort.attach(redis, 'fsort');

      // init token manager
      const tokenManagerOpts = { backend: { connection: redis } };
      this.tokenManager = new TokenManager(merge({}, config.tokenManager, tokenManagerOpts));

      inactiveUsers.defineCommand(redis, config.redis);
      this.on('users:cleanup', inactiveUsers.cleanUsers);
    });

    this.on('plugin:start:http', (server) => {
      // if oAuth is enabled - initiate the strategy
      if (get(config, 'oauth.enabled', { default: false }) === true) {
        assert.equal(config.http.server.handler, 'hapi', 'oAuth must be used with hapi.js webserver');

        const OAuthStrategyHandler = require('./auth/oauth/hapi');
        this.oauth = new OAuthStrategyHandler(server, config);
      }
    });

    this.on('plugin:stop:http', () => {
      this.oauth = null;
    });

    // cleanup connections
    this.on(`plugin:close:${this.redisType}`, () => {
      this.dlock = null;
      this.tokenManager = null;
      this.removeListener('users:cleanup');
    });

    // add migration connector
    if (config.migrations.enabled === true) {
      this.addConnector(ConnectorsTypes.migration, () => (
        this.migrate('redis', `${__dirname}/migrations`)
      ));
    }

    // ensure we close connection when needed
    this.addDestructor(ConnectorsTypes.database, () => (
      this.pubsub.quit().reflect()
    ));

    // add lock manager
    this.addConnector(ConnectorsTypes.migration, async () => {
      this.pubsub = redisDuplicate(this.redis);
      await this.pubsub.connect();

      this.dlock = new LockManager({
        ...config.lockManager,
        client: this.redis,
        pubsub: this.pubsub,
        log: this.log,
      });

      return this.dlock;
    });

    // init account seed
    this.addConnector(ConnectorsTypes.application, () => (
      this.initAdminAccounts()
    ));

    // fake accounts for development
    if (process.env.NODE_ENV === 'development') {
      this.addConnector(ConnectorsTypes.application, () => (
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
