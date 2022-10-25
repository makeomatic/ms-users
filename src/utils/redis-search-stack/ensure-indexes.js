const Promise = require('bluebird');
const createHashIndex = require('./create-hash-index');

/**
 * Creates redis search indexes for user list action
 * @return {Promise}
 */
async function ensureSearchIndexes(service) {
  const {
    redis,
    redisIndexDefinitions: definitions,
  } = service.config;

  const createPromises = definitions.map((def) => {
    return createHashIndex(service, redis.keyPrefix, def);
  });

  return Promise.allSettled(createPromises); // TODO or all?
}

module.exports = ensureSearchIndexes;
