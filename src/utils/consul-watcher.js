const handleErr = (log, payload) => (err) => {
  log.error({ err, ...payload }, 'Consul watch error');
};

class ConsulWatcher {
  constructor(consul, log) {
    this.consul = consul;
    this.log = log;
  }

  /**
   * This watch returns all keys matching the prefix whenever any key matching the prefix changes
   */
  watchKeyPrefix(keyPrefix, onChange, options) {
    const { kv } = this.consul;
    const watch = this.consul.watch({
      method: kv.get,
      options: { key: keyPrefix, recurse: true },
      ...options,
    });
    watch.on('change', onChange);
    watch.on('error', handleErr(this.log, { keyPrefix }));
    return watch;
  }

  // watchKey(key, onChange, options) {}

  static endWatch(watch) {
    watch.end();
  }
}

module.exports = {
  ConsulWatcher,
};
