const Promise = require('bluebird');
const redisKey = require('../key');
const createHashIndex = require('./create-hash-index');

/**
 * Creates redis search index matrix for user list action
 * @return {Promise}
 */
async function ensureSearchIndexes(service) {
  const { redisIndexDefinitions } = service.config;

  const createIndexes = redisIndexDefinitions.map(({ baseKey, audience, fields }) => {
    const result = [];

    // create indexes matrix depends on all audience
    for (const name of audience) {
      const indexOnKey = redisKey(baseKey, name);
      result.push(createHashIndex(service, indexOnKey, fields));
    }
    return result;
  });

  return Promise.allSettled(createIndexes); // TODO or all?
}

module.exports = ensureSearchIndexes;
