const { KEY_PREFIX_INVOCATION_RULES } = require('../constants');
const { ConsulWatcher } = require('./consul-watcher');

/**
 * Memory storage
 */
class InvocationRulesStorage {
  constructor(consulWatcher, watchOptions, log) {
    this.consulWatcher = consulWatcher;
    this.watchOptions = watchOptions;
    this.log = log;
    this.watchInstance = null;
    this.rules = null;
  }

  startSync() {
    const { consulWatcher } = this;

    if (this.watchInstance) {
      throw new Error('Invocation rules sync has already been started');
    }

    this.watchInstance = consulWatcher.watchKeyPrefix(
      KEY_PREFIX_INVOCATION_RULES,
      (data) => {
        const value = data === undefined ? null : data;
        this.rules = value;
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
  getRules() {
    return this.rules;
  }
}

module.exports = {
  InvocationRulesStorage,
};
