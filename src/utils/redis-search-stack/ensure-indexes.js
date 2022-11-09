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
  }

  buildIndexName(filterKey) {
    const { keyPrefix } = this.redisConfig.options;

    return normalizeIndexName(redisKey(keyPrefix, filterKey));
  }

  getIndexName(audience) {
    const name = this.indexByAudience.get(audience);
    if (!name) {
      throw ErrorSearchIndexNotFound(audience);
    }

    return name;
  }

  /**
   * Creates redis search index matrix for user list action
   * @return {Promise}
   */
  ensureSearchIndexes() {
    const { keyPrefix } = this.redisConfig.options;

    const createIndexes = this.definitions.map(({ filterKey, audience, fields }) => {
      const result = [];
      const indexName = this.buildIndexName(filterKey);
      const filter = redisKey(filterKey, audience);

      this.log.debug('registering FT index for %s: %s', audience, indexName);

      result.push(createHashIndex(this.service, indexName, keyPrefix, filter, fields));
      this.indexByAudience.set(audience, indexName);

      return result;
    });

    this.log.info('FT indexes registered: %d', this.indexByAudience.size);

    return Promise.all(createIndexes);
  }
}

module.exports = RedisSearchIndexes;
