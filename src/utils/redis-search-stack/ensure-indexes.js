const Promise = require('bluebird');
const redisKey = require('../key');
const createHashIndex = require('./create-hash-index');

/**
 * Creates redis search index matrix for user list action
 * @return {Promise}
 */
async function ensureSearchIndexes(service) {
  const { redisIndexDefinitions } = service.config;
  const { keyPrefix } = service.config.redis.options;

  const createIndexes = redisIndexDefinitions.map(({ filterKey, audience, fields }) => {
    const result = [];

    // create indexes matrix depends on all audience
    for (const item of audience) {
      const filter = redisKey(filterKey, item);
      result.push(createHashIndex(service, keyPrefix, filter, fields));
    }
    return result;
  });

  return Promise.allSettled(createIndexes); // TODO or all?
}

module.exports = ensureSearchIndexes;
