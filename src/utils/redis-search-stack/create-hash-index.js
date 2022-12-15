const redisKey = require('../key');
const { containsKeyExpr } = require('./expressions');

/**
 * @param {Object} service provides redis, log
 * @param {Object} keyPrefix root prefix, e.g. {ms-users}
 * @param {string} definition array of objects [key, fields: [ field, type]]
 * @returns {Promise}
 */

async function createHashIndex({ redis, log }, indexName, prefix, filter, fields) {
  log.debug({ filter, fields }, `create search index: ${indexName}`);

  const filterExpr = [];

  if (filter) {
    const key = redisKey('', filter); // leading separator
    filterExpr.push('FILTER');
    filterExpr.push(containsKeyExpr(key));
  }

  try {
    return await redis.call(
      'FT.CREATE',
      indexName,
      'ON',
      'HASH',
      'PREFIX',
      '1',
      prefix,
      ...filterExpr,
      'SCHEMA',
      ...fields.flatMap((x) => x)
    );
  } catch (err) {
    log.error({ err, indexName }, 'create index error');

    return false;
  }
}

module.exports = createHashIndex;
