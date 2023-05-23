const redisKey = require('../key');
const { containsKeyExpr } = require('./expressions');

/**
 * @param {Object} service provides redis, log
 * @param {Object} keyPrefix root prefix, e.g. {ms-users}
 * @param {string} definition array of objects [key, fields: [ field, type]]
 * @returns {Promise}
 */

async function createHashIndex({ redis, log }, indexName, prefix, keyFilter, filterByProperty, fields) {
  log.debug({ keyFilter, fields }, `create search index: ${indexName}`);

  const filterExpr = [];

  if (keyFilter) {
    const key = redisKey('', keyFilter); // leading separator
    filterExpr.push(containsKeyExpr(key));
  }

  if (filterByProperty) {
    filterExpr.push(filterByProperty);
  }

  const filterParam = (filterExpr.length > 0 ? ['FILTER', `(${filterExpr.join(' && ')})`] : []);

  try {
    return await redis.call(
      'FT.CREATE',
      indexName,
      'ON',
      'HASH',
      'PREFIX',
      '1',
      prefix,
      ...filterParam,
      'SCHEMA',
      ...fields.flatMap((x) => x)
    );
  } catch (err) {
    log.error({ err, indexName }, 'create index error');

    return false;
  }
}

module.exports = createHashIndex;
