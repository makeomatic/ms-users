const Promise = require('bluebird');
const last = require('lodash/last');

const { ActionTransport } = require('@microfleet/core');
const redisKey = require('../../utils/key');
const handlePipeline = require('../../utils/pipelineError');
const setMetadata = require('../../utils/updateMetadata');
const { getOrganizationId } = require('../../utils/organizationData');
const {
  ErrorConflictOrganizationExists,
  ORGANIZATIONS_CREATED_FIELD,
  ORGANIZATIONS_NAME_FIELD,
  ORGANIZATIONS_ACTIVE_FLAG,
  ORGANIZATIONS_DATA,
  ORGANIZATIONS_NAME_TO_ID,
  ORGANIZATIONS_ID_FIELD,
} = require('../../constants');

const ErrorMissing = { statusCode: 404 };

// init transport
module.exports.transports = [ActionTransport.amqp, ActionTransport.internal];

module.exports = async function createOrganization({ params }) {
  const service = this;
  const { redis } = service;
  const { organizationName, active, audience, metadata } = params;
  const defaultAudience = last(audience);

  // do verifications of DB state
  await Promise.bind(service, organizationName)
    .tap(getOrganizationId)
    .throw(ErrorConflictOrganizationExists)
    .catchReturn(ErrorMissing, organizationName);

  const organizationId = service.flake.next();
  const created = Date.now();
  const pipeline = redis.pipeline();
  const basicInfo = {
    [ORGANIZATIONS_CREATED_FIELD]: created,
    [ORGANIZATIONS_NAME_FIELD]: organizationName,
    [ORGANIZATIONS_ACTIVE_FLAG]: Boolean(active),
  };

  const organizationDataKey = redisKey(organizationId, ORGANIZATIONS_DATA);
  pipeline.hmset(organizationDataKey, basicInfo);
  pipeline.hset(ORGANIZATIONS_NAME_TO_ID, organizationName, organizationId);

  await pipeline.exec().then(handlePipeline);
  await setMetadata.call(service, {
    organizationId,
    audience,
    metadata: audience.map(metaAudience => ({
      $set: Object.assign(metadata[metaAudience] || {}, metaAudience === defaultAudience && {
        [ORGANIZATIONS_ID_FIELD]: organizationId,
        [ORGANIZATIONS_NAME_FIELD]: organizationName,
        [ORGANIZATIONS_CREATED_FIELD]: created,
      }),
    })),
  });
  // ToDo await addOrganizationMembers()
  // return createdOrganization()
};
