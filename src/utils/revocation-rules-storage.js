const { KEY_PREFIX_REVOCATION_RULES } = require('../constants');
const { ConsulWatcher } = require('./consul-watcher');
const { ListFilter } = require('./radix-filter/list-filter');

/** @typedef { import("./revocation-rules-manager").RevocationRulesManager } RevocationRulesManager */

/**
 * Memory storage
 */
class RevocationRulesStorage {
  constructor(ruleManager, consulWatcher, watchOptions, log) {
    /** @type {RevocationRulesManager} */
    this.ruleManager = ruleManager;
    /** @type {ConsulWatcher} */
    this.consulWatcher = consulWatcher;
    this.watchOptions = watchOptions;
    this.log = log;
    this.watchInstance = null;
    this.cache = {};
  }

  _invalidateCache(key, version) {
    const cached = this.cache[key];
    if (cached && cached.version < version) {
      this.cache[key] = {
        version,
        rules: null,
      };
    }
  }

  setCache(rules, key, version) {
    this.cache[key] = {
      version,
      rules,
    };
  }

  async getRules(key) {
    const cached = this.cache[key];
    if (cached && cached.rules !== null) {
      return cached.rules;
    }

    const rulesRaw = await this.ruleManager.list(key);
    const rules = new ListFilter(this.log);

    rules.addBatch(rulesRaw);
    this.setCache(rules, key, Date.now());

    return rules;
  }

  startSync() {
    const { consulWatcher } = this;

    if (this.watchInstance) {
      throw new Error('Revocation rules sync has already been started');
    }

    this.watchInstance = consulWatcher.watchKeyPrefix(
      KEY_PREFIX_REVOCATION_RULES,
      (data) => {
        const value = data === undefined ? [] : data;
        for (const { Key: key, Value: version } of value) {
          this._invalidateCache(
            key.substring(KEY_PREFIX_REVOCATION_RULES.length),
            parseInt(version, 10)
          );
        }
      },
      this.watchOptions
    );
  }

  stopSync() {
    ConsulWatcher.endWatch(this.watchInstance);
    this.watchInstance = null;
  }

  /**
   * Raw unserialized
   */
  getFilter() {
    return this.cache;
  }
}

module.exports = {
  RevocationRulesStorage,
};
