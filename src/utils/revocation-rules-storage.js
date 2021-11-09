const { KEY_PREFIX_REVOCATION_RULES } = require('../constants');
const { ConsulWatcher } = require('./consul-watcher');

const { ListFilter } = require('./radix-filter/list-filter');
const { RadixStorage } = require('./radix-filter/storage');

const newListFilter = (log) => {
  const storage = new RadixStorage();
  return new ListFilter(storage, log);
};

/**
 * Memory storage
 */
class RevocationRulesStorage {
  constructor(consulWatcher, watchOptions, log) {
    this.consulWatcher = consulWatcher;
    this.watchOptions = watchOptions;
    this.log = log;
    this.watchInstance = null;
    this.filter = newListFilter(log);
  }

  _reloadRules(data) {
    const newList = newListFilter(this.log);
    newList.addRaw(data);
    this.filter = newList;
  }

  startSync() {
    const { consulWatcher } = this;

    if (this.watchInstance) {
      throw new Error('Invocation rules sync has already been started');
    }

    this.watchInstance = consulWatcher.watchKeyPrefix(
      KEY_PREFIX_REVOCATION_RULES,
      (data) => {
        const value = data === undefined ? [] : data;

        const asRule = value.map(({ Key: key, Value: params }) => (
          {
            key: key.substring(KEY_PREFIX_REVOCATION_RULES.length),
            params,
          }
        ));

        this._reloadRules(asRule);
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
    return this.filter;
  }
}

module.exports = {
  RevocationRulesStorage,
};
