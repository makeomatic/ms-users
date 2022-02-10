const { Microfleet, ConnectorsTypes } = require('@microfleet/core');
const Mailer = require('ms-mailer-client');
const merge = require('lodash/merge');
const { strict: assert } = require('assert');
const fsort = require('redis-filtered-sort');
const { TokenManager } = require('ms-token');
const Flakeless = require('ms-flakeless');

const conf = require('./config');
const get = require('./utils/get-value');
const attachPasswordKeyword = require('./utils/password-validator');
const { CloudflareWorker } = require('./utils/cloudflare/worker');
const { ConsulWatcher } = require('./utils/consul-watcher');
const { RevocationRulesStorage } = require('./utils/revocation-rules-storage');
const { RevocationRulesManager } = require('./utils/revocation-rules-manager');

/**
 * @namespace Users
 */
class Users extends Microfleet {
  /**
   * @namespace Users
   * @param  {Object} opts
   * @return {Users}
   */
  constructor(opts = {}) {
    super(merge({}, Users.defaultOpts, opts));

    /**
     * Initializes Admin accounts
     * @returns {Promise}
     */
    this.initAdminAccounts = require('./accounts/init-admin');

    /**
     * Initializes fake account for dev purposes
     * @returns {Promise}
     */
    this.initFakeAccounts = require('./accounts/init-dev');

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

    // id generator
    this.flake = new Flakeless(config.flake);

    this.on('plugin:connect:amqp', (amqp) => {
      this.mailer = new Mailer(amqp, config.mailer);
    }, 'mailer');

    this.on('plugin:close:amqp', () => {
      this.mailer = null;
    });

    this.on(`plugin:connect:${this.redisType}`, (redis) => {
      fsort.attach(redis, 'fsort');

      // init token manager
      const tokenManagerOpts = { backend: { connection: redis } };
      const tmOpts = merge({}, config.tokenManager, tokenManagerOpts);

      this.tokenManager = new TokenManager(tmOpts);
    });

    this.on('plugin:start:http', (server) => {
      // if oAuth is enabled - initiate the strategy
      if (get(config, 'oauth.enabled', { default: false }) === true) {
        assert(config.plugins.includes('hapi'), 'oAuth must be used with hapi.js webserver');

        const OAuthStrategyHandler = require('./auth/oauth/hapi');
        this.oauth = new OAuthStrategyHandler(server, config);
      }
    });

    this.on('plugin:stop:http', () => {
      this.oauth = null;
    });

    // cleanup connections
    this.on(`plugin:close:${this.redisType}`, () => {
      this.tokenManager = null;
    });

    // add migration connector
    if (config.migrations.enabled === true) {
      this.addConnector(ConnectorsTypes.migration, () => (
        this.migrate('redis', `${__dirname}/migrations`)
      ), 'redis-migration');
    }

    this.addConnector(ConnectorsTypes.essential, () => {
      attachPasswordKeyword(this);
    });

    this.bypass = {};

    if (this.config.bypass.pumpJack.enabled) {
      this.addConnector(ConnectorsTypes.essential, () => {
        const PumpJackService = require('./utils/bypass/pump-jack');
        this.bypass.pumpJack = new PumpJackService(this);
      }, 'bypass.pumpJack');
    }

    const allowBypasses = Object.entries(this.config.bypass).filter(([, schemeConfig]) => schemeConfig.enabled);

    const bypassesMasters = allowBypasses.filter(([, schemeConfig]) => schemeConfig.provider === 'masters');

    for (const [schemeName, schemeConfig] of bypassesMasters) {
      this.addConnector(ConnectorsTypes.essential, () => {
        const MastersService = require('./utils/bypass/masters');
        this.bypass[schemeName] = new MastersService(this, schemeConfig);
      });
    }

    if (this.config.cfAccessList.enabled) {
      this.initConsul();

      this.addConnector(ConnectorsTypes.application, () => {
        this.cfWorker = new CloudflareWorker(this, this.config.cfAccessList);
        this.cfAccessList = this.cfWorker.cfList;
        this.cfWorker.start();
      });

      this.addDestructor(ConnectorsTypes.application, () => {
        this.cfWorker.stop();
      });
    }

    if (this.config.revocationRules.enabled) {
      this.initJwtRevocationRules();
    }

    // init account seed
    this.addConnector(ConnectorsTypes.application, () => (
      this.initAdminAccounts()
    ), 'admins');

    // fake accounts for development
    if (process.env.NODE_ENV === 'development') {
      this.addConnector(ConnectorsTypes.application, () => (
        this.initFakeAccounts()
      ), 'dev accounts');
    }
  }

  initConsul() {
    if (!this.hasPlugin('consul') && !this.consul) {
      const consul = require('@microfleet/plugin-consul');
      this.initPlugin(consul, this.config.consul);
    }
  }

  initJwtRevocationRules() {
    this.initConsul();

    const pluginName = 'JwtRevocationRules';

    if (this.config.revocationRules.syncEnabled) {
      this.addConnector(ConnectorsTypes.application, () => {
        this.revocationRulesManager = new RevocationRulesManager(
          this.config.revocationRules, this
        );

        const watcher = new ConsulWatcher(this.consul, this.log);

        this.revocationRulesStorage = new RevocationRulesStorage(
          this.revocationRulesManager,
          watcher,
          this.config.revocationRules.watchOptions,
          this.log
        );

        this.revocationRulesStorage.startSync();
      }, pluginName);

      this.addDestructor(ConnectorsTypes.application, () => {
        this.revocationRulesStorage.stopSync();
      }, pluginName);
    }
  }
}

/**
 * Configuration options for the service
 * @type {Object}
 */
Users.defaultOpts = conf.get('/', { env: process.env.NODE_ENV });

module.exports = Users;
