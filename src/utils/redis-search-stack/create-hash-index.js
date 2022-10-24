/**
 * @param {Object} service provides redis, log
 * @param {Object} keyPrefix root prefix, e.g. {ms-users}
 * @param {string} definition array of objects [key, fields: [ field, type]]
 * @returns {Promise}
 */

async function createHashIndex({ redis, log }, keyPrefix, definition) {
  const { key, fields } = definition;

  const name = `${key.replaceAll('!', '_')}_idx`;
  log.debug({ keyPrefix, definition }, `create index: ${name}`);

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
