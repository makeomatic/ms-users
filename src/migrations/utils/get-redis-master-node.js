const calcSlot = require('cluster-key-slot');

/**
 * Return master node in case of redisCluster to be able to use
 * specific commands like `keys`. We can use usual redis instance in
 * other cases.
 */

module.exports = function getRedisMasterNode(redis, config) {
  if (!config.plugins.includes('redisCluster')) {
    return redis;
  }
  const { keyPrefix } = config.redis.options;
  const slot = calcSlot(keyPrefix);
  const nodeKeys = redis.slots[slot];
  const masters = redis.connectionPool.nodes.master;

  return nodeKeys.reduce((node, key) => node || masters[key], null);
};
