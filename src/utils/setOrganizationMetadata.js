/* eslint-disable no-mixed-operators */
const Promise = require('bluebird');
const is = require('is');
const { HttpStatusError } = require('common-errors');
const redisKey = require('../utils/key.js');
const handlePipeline = require('../utils/pipelineError.js');
const { handleAudience } = require('../utils/updateMetadata.js');
const { ORGANIZATIONS_METADATA } = require('../constants.js');

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

  // keys
  const keys = audiences.map(aud => redisKey(organizationId, ORGANIZATIONS_METADATA, aud));

  // if we have meta, then we can
  if (metadata) {
    const pipe = redis.pipeline();
    const metaOps = is.array(metadata) ? metadata : [metadata];

    if (metaOps.length !== audiences.length) {
      return Promise.reject(new HttpStatusError(400, 'audiences must match metadata entries'));
    }

    metaOps.forEach((meta, idx) => handleAudience(pipe, keys[idx], meta));
    await pipe.exec().then(handlePipeline);
  }

  return true;
}

module.exports = setOrganizationMetadata;
