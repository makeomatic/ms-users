const createHashIndex = require('./create-hash-index');

const redisKey = require('../key');
const { ErrorSearchIndexNotFound } = require('../../constants');

class RedisSearchIndexes {
  constructor(service) {
    this.service = service;
    this.log = service.log;

    this.definitions = service.config.redisIndexDefinitions;
    this.redisConfig = service.config.redis;

    this.indexMetadata = new Map();
  }

  setIndexMetadata(audience, indexName, filterKey, multiWords) {
    const metadata = { indexName, filterKey, multiWords };
    this.indexMetadata.set(audience, metadata);
  }

  buildIndexName(indexKey, version = '1') {
    const { keyPrefix } = this.redisConfig.options;

    const key = redisKey(keyPrefix, indexKey, `v${version}`);

    return `${key.replaceAll('!', '-')}-idx`;
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

    const createIndexes = this.definitions.map(({ version = '1', filterKey, audience, fields, multiWords }) => {
      const result = [];

      // create indexes matrix depends on all audience
      for (const audienceKey of audience) {
        const filter = redisKey(filterKey, audienceKey);
        const indexName = this.buildIndexName(filter, version);

        result.push(createHashIndex(this.service, indexName, keyPrefix, filter, fields));

        this.log.debug('registering FT index for %s audience - %s', audience, indexName);

        this.setIndexMetadata(audienceKey, indexName, filterKey, multiWords);
      }

      return result;
    });

    this.log.info('FT indexes registered: %d', this.indexMetadata.size);
    return Promise.all(createIndexes);
  }
}

module.exports = RedisSearchIndexes;
