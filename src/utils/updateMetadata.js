/* eslint-disable no-mixed-operators */
const redisKey = require('../utils/key.js');

const MetaUpdate = require('../utils/metadata/redis/update-metadata');
const { USERS_METADATA, USERS_AUDIENCE } = require('../constants.js');

/**
 * Updates metadata on a user object
 * @param  {Object} opts
 * @return {Promise}
 */
async function updateMetadata(opts) {
  const audienceKeyTemplate = redisKey('{id}', USERS_AUDIENCE);
  const metaDataTemplate = redisKey('{id}', USERS_METADATA, '{audience}');
  const metaUpdater = new MetaUpdate(this.redis, metaDataTemplate, audienceKeyTemplate);
  const { userId, ...restOpts } = opts;
  return metaUpdater.update({ id: userId, ...restOpts });
}

module.exports = updateMetadata;
