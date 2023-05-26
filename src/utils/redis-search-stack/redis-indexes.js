const createHashIndex = require('./create-hash-index');
const redisKey = require('../key');
const { ErrorSearchIndexNotFound } = require('../../constants');
const { extractFieldTypes } = require('./extract-field-definitions');

const normalizeIndexName = (key) => `${key.replaceAll('!', '-')}-idx`;

class RedisSearchIndexes {
  constructor(service) {
    this.service = service;
    this.log = service.log;

    this.definitions = service.config.redisIndexDefinitions;
    this.redisConfig = service.config.redis;

    this.indexMetadata = new Map();
  }

  setIndexMetadata(audience, indexName, filterKey, multiWords, fieldTypes) {
    const metadata = { indexName, filterKey, multiWords, fieldTypes };
    this.indexMetadata.set(audience, metadata);
  }

  buildIndexName(indexKey, version = '1') {
    const { keyPrefix } = this.redisConfig.options;

    return normalizeIndexName(redisKey(keyPrefix, indexKey, `v${version}`));
  }

  getIndexMetadata(audience) {
    const metadata = this.indexMetadata.get(audience);
    if (!metadata) {
      throw ErrorSearchIndexNotFound(audience);
    }

    return metadata;
  }

  /**
   * Creates redis search index matrix for user list action
   * @return {Promise}
   */
  ensureSearchIndexes() {
    const { keyPrefix } = this.redisConfig.options;

    const createIndexes = this.definitions.map(({ version = '1', filterKey, filterByProperty, audience, fields, multiWords }) => {
      const result = [];

      // create indexes matrix depends on all audience
      for (const audienceKey of audience) {
        const filter = redisKey(filterKey, audienceKey);
        const indexName = this.buildIndexName(filter, version);

        result.push(createHashIndex(this.service, indexName, keyPrefix, filter, filterByProperty, fields));
        const fieldTypes = extractFieldTypes(fields);

        this.log.debug('registering FT index for %s audience - %s', audience, indexName, fieldTypes);

        this.setIndexMetadata(audienceKey, indexName, filterKey, multiWords, fieldTypes);
      }

      return result;
    });

    this.log.info('FT indexes registered: %d', this.indexMetadata.size);
    return Promise.all(createIndexes);
  }
}

module.exports = RedisSearchIndexes;
