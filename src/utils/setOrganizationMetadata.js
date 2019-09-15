/* eslint-disable no-mixed-operators */
const Promise = require('bluebird');
const is = require('is');
const { HttpStatusError } = require('common-errors');
const redisKey = require('../utils/key.js');
const { prepareOps } = require('./updateMetadata');
const { ORGANIZATIONS_METADATA, ORGANIZATIONS_AUDIENCE } = require('../constants.js');

const JSONStringify = (data) => JSON.stringify(data);

function callUpdateMetadataScript(redis, id, ops) {
  const audienceKeyTemplate = redisKey('{id}', ORGANIZATIONS_AUDIENCE);
  const metaDataTemplate = redisKey('{id}', ORGANIZATIONS_METADATA, '{audience}');

  return redis
    .updateMetadata(2, audienceKeyTemplate, metaDataTemplate, id, JSONStringify(ops));
}

/**
 * Updates metadata on a organization object
 * @param  {Object} opts
 * @return {Promise}
 */
async function setOrganizationMetadata(opts) {
  const { redis } = this;
  const {
    organizationId, audience, metadata,
  } = opts;
  const audiences = is.array(audience) ? audience : [audience];

  // if we have meta, then we can
  if (metadata) {
    const rawMetaOps = is.array(metadata) ? metadata : [metadata];
    if (rawMetaOps.length !== audiences.length) {
      return Promise.reject(new HttpStatusError(400, 'audiences must match metadata entries'));
    }

    const metaOps = rawMetaOps.map((opBlock) => prepareOps(opBlock));

    const scriptOpts = { metaOps, audiences };
    return callUpdateMetadataScript(redis, organizationId, scriptOpts);
  }

  return true;
}

module.exports = setOrganizationMetadata;
