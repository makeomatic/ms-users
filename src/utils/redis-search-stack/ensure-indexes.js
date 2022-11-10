const Promise = require('bluebird');

const normalizeIndexName = require('./normalize-index-name');
const createHashIndex = require('./create-hash-index');

const redisKey = require('../key');
const { ErrorSearchIndexNotFound } = require('../../constants');

class RedisSearchIndexes {
  constructor(service) {
    this.service = service;
    this.log = service.log;

    this.definitions = service.config.redisIndexDefinitions;
    this.redisConfig = service.config.redis;

    this.indexByAudience = new Map();
    this.filterKeyByAudience = new Map();
  }

  buildIndexName(indexKey) {
    const { keyPrefix } = this.redisConfig.options;

    return normalizeIndexName(redisKey(keyPrefix, indexKey));
  }

  getIndexName(audience) {
    const name = this.indexByAudience.get(audience);
    if (!name) {
      throw ErrorSearchIndexNotFound(audience);
    }

    return name;
  }

  getFilterKey(audience) {
    return this.filterKeyByAudience.get(audience);
  }

  /**
   * Creates redis search index matrix for user list action
   * @return {Promise}
   */
  ensureSearchIndexes() {
    const { keyPrefix } = this.redisConfig.options;

    const createIndexes = this.definitions.map(({ filterKey, audience, fields }) => {
      const result = [];

      // create indexes matrix depends on all audience
      for (const audienceKey of audience) {
        const filter = redisKey(filterKey, audienceKey);
        const indexName = this.buildIndexName(filter);

        result.push(createHashIndex(this.service, indexName, keyPrefix, filter, fields));

        this.log.debug('registering FT index for %s audience - %s', audience, indexName);

        this.indexByAudience.set(audienceKey, indexName);
        this.filterKeyByAudience.set(audienceKey, filterKey);
      }

      return result;
    });

    this.log.info('FT indexes registered: %d', this.indexByAudience.size);

    return Promise.all(createIndexes);
  }
}

module.exports = RedisSearchIndexes;
