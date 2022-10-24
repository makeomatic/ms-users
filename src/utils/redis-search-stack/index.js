const Promise = require('bluebird');
const createHashIndex = require('./create-hash-index');

/**
 * Creates indexes for redis search on user list action
 * @return {Promise}
 */
async function ensureSearchIndexes(service, definitions) {
  const { redis, redisSearch } = service.config;

  if (!redisSearch.enabled) {
    service.log.warn('redis search is disabled, skip creating indexes');

    return false;
  }

  const createPromises = definitions.map((def) => {
    return createHashIndex(service, redis.keyPrefix, def);
  });

  return Promise.allSettled(createPromises); // TODO or all?
}

module.exports = ensureSearchIndexes;
