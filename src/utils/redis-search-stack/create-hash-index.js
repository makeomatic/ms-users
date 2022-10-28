const normalizeIndexName = require('./normalize-index-name');

/**
 * @param {Object} service provides redis, log
 * @param {Object} keyPrefix root prefix, e.g. {ms-users}
 * @param {string} definition array of objects [key, fields: [ field, type]]
 * @returns {Promise}
 */

async function createHashIndex({ redis, config, log }, key, fields) {
  const { keyPrefix } = config.redis.options;

  const name = normalizeIndexName(keyPrefix, key);
  log.debug({ key, fields }, `create search index: ${name}`);

  try {
    return redis.call(
      'FT.CREATE',
      `${name}`,
      'ON',
      'HASH',
      'PREFIX',
      '1',
      `${keyPrefix}${key}`,
      'SCHEMA',
      ...fields.flatMap((x) => x)
    );
  } catch (err) {
    log.error(`create ${name} index error %j`, err);
    throw err;
  }
}

module.exports = createHashIndex;
