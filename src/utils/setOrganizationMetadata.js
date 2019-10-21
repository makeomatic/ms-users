/* eslint-disable no-mixed-operators */
const MetaUpdate = require('../utils/metadata/redis/update-metadata');
const redisKey = require('../utils/key.js');

const { ORGANIZATIONS_METADATA, ORGANIZATIONS_AUDIENCE } = require('../constants.js');


/**
 * Updates metadata on a organization object
 * @param  {Object} opts
 * @return {Promise}
 */
async function setOrganizationMetadata(opts) {
  const audienceKeyTemplate = redisKey('{id}', ORGANIZATIONS_AUDIENCE);
  const metaDataTemplate = redisKey('{id}', ORGANIZATIONS_METADATA, '{audience}');
  const metaUpdater = new MetaUpdate(this.redis, metaDataTemplate, audienceKeyTemplate);
  const { organizationId, ...restOpts } = opts;
  return metaUpdater.update({ id: organizationId, ...restOpts });
}

module.exports = setOrganizationMetadata;
