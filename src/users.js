const { Microfleet, ConnectorsTypes } = require('@microfleet/core');
const Mailer = require('ms-mailer-client');
const { strict: assert } = require('assert');
const fsort = require('redis-filtered-sort');
const { TokenManager } = require('ms-token');
const Flakeless = require('ms-flakeless');
const deepmerge = require('@fastify/deepmerge')({
  mergeArray(options) {
    const { clone } = options;
    return function replaceByClonedSource(_, source) {
      return clone(source);
    };
  },
});
const getStore = require('./config');
const get = require('./utils/get-value');
const attachPasswordKeyword = require('./utils/password-validator');
const { CloudflareWorker } = require('./utils/cloudflare/worker');
const { ConsulWatcher } = require('./utils/consul-watcher');
const { rule: { RevocationRulesStorage, RevocationRulesManager } } = require('./utils/stateless-jwt');
const { JoseWrapper } = require('./utils/stateless-jwt/jwe');
const { CredentialsStore } = require('./utils/credentials-store');

/**
 * @class Users
 */
class Users extends Microfleet {
  /**
   * @namespace Users
   * @param  {Object} opts
   * @return {Users}
   */
  constructor(opts) {
    super(opts);

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
      trustedVerify: `${prefix}.verify-trusted`,
      apiTokenVerify: `${prefix}.verify-api-token`,
      tokenGet: `${prefix}.token.get`,
      timeouts: {
        verify: 5000,
        trustedVerify: 5000,
        apiTokenVerify: 5000,
        tokenGet: 5000,
      },
    };

    // id generator
    this.flake = new Flakeless(config.flake);

    this.on('plugin:connect:amqp', (amqp) => {
      this.mailer = new Mailer(amqp, config.mailer);
      this.credentialsStore = new CredentialsStore(amqp, config.users);
    }, 'mailer');

    this.on('plugin:close:amqp', () => {
      this.mailer = null;
    });

    this.on(`plugin:connect:${this.redisType}`, (redis) => {
      fsort.attach(redis, 'fsort');

      // init token manager
      const tmOpts = deepmerge({}, config.tokenManager);
      tmOpts.backend.connection = redis;

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

    if (this.config.redisSearch.enabled) {
      this.addConnector(ConnectorsTypes.migration, async () => {
        // redis search indexes
        const { RedisSearchIndexes } = require('./utils/redis-search-stack');

        this.redisSearch = new RedisSearchIndexes(this);
        await this.redisSearch.ensureSearchIndexes();
      }, 'redis-search-index');
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

    if (this.config.bypass.streamlayer.enabled) {
      this.addConnector(ConnectorsTypes.essential, () => {
        const StreamLayerService = require('./utils/bypass/streamlayer');
        this.bypass.streamlayer = new StreamLayerService(this);
      }, 'bypass.streamlayer');
    }

    if (this.config.bypassGeneric) {

      const providers = Object.keys(this.config.bypassGeneric)

      for(const provider of providers) {

        
        this.bypass.generic = {}
        const providerConfig = this.config.bypassGeneric[provider]

        this.addConnector(ConnectorsTypes.essential, () => {
          const GenericBypassService = require('./utils/bypass/generic');
          this.bypass.generic[provider] = new GenericBypassService(this, providerConfig);
        }, `bypass.generic`);
      }
      // const { generic } = this.config.bypass

      // this.addConnector(ConnectorsTypes.essential, () => {
      //   const GenericBypassService = require('./utils/bypass/generic');
      //   this.bypass.generic = new GenericBypassService(this, generic);
      // }, 'bypass.generic');
    }

    const { slrAnonymous } = this.config.bypass;
    if (slrAnonymous.enabled) {
      this.addConnector(ConnectorsTypes.essential, () => {
        const StreamLayerAnonymousService = require('./utils/bypass/slr-anonymous');
        this.bypass[slrAnonymous.provider] = new StreamLayerAnonymousService(this, slrAnonymous);
      }, 'bypass.slrAnonymous');
    }

    const allowBypasses = Object.entries(this.config.bypass).filter(([, schemeConfig]) => schemeConfig.enabled);

    const bypassesMasters = allowBypasses.filter(([, schemeConfig]) => schemeConfig.provider === 'masters');

    for (const [schemeName, schemeConfig] of bypassesMasters) {
      this.addConnector(ConnectorsTypes.essential, () => {
        const MastersService = require('./utils/bypass/masters');
        this.bypass[schemeName] = new MastersService(this, schemeConfig);
      }, schemeName);

      this.addDestructor(ConnectorsTypes.database, async () => {
        await this.bypass[schemeName].close();
      }, schemeName);
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

    const { jwt: { stateless } } = this.config;
    if (stateless.enabled) {
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
    const { jwt: { stateless: { storage, jwe } } } = this.config;

    this.addConnector(ConnectorsTypes.application, async () => {
      const watcher = new ConsulWatcher(this.consul, this.log);
      this.jwe = new JoseWrapper(jwe);

      await this.jwe.init();

      this.revocationRulesManager = new RevocationRulesManager(this);
      this.revocationRulesStorage = new RevocationRulesStorage(
        this.revocationRulesManager,
        watcher,
        storage,
        this.log
      );

      this.revocationRulesStorage.startSync();
    }, pluginName);

    this.addDestructor(ConnectorsTypes.application, () => {
      this.revocationRulesStorage.stopSync();
    }, pluginName);
  }
}

async function initUsers(override = {}) {
  const store = await getStore({ env: process.env.NODE_ENV });
  const users = new Users(deepmerge(store.get('/'), override));
  return users;
}

exports = module.exports = initUsers;
exports.Users = Users;
exports.default = initUsers;
