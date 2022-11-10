const redisKey = require('../key');
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
    filterExpr.push(`'contains(@__key, ${key}) > 0'`);
  }

  try {
    return redis.call(
      'FT.CREATE',
      `${indexName}`,
      'ON',
      'HASH',
      'PREFIX',
      '1',
      `${prefix}`,
      ...filterExpr,
      'SCHEMA',
      ...fields.flatMap((x) => x)
    );
  } catch (err) {
    log.error(`create ${indexName} index error %j`, err);
    throw err;
  }
}

module.exports = createHashIndex;
