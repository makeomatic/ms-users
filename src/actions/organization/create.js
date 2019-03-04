const Promise = require('bluebird');

const { ActionTransport } = require('@microfleet/core');
const redisKey = require('../../utils/key');
const handlePipeline = require('../../utils/pipelineError');
const setOrganizationMetadata = require('../../utils/setOrganizationMetadata');
const addOrganizationMembers = require('../../utils/addOrganizationMembers');
const { getOrganizationId, getInternalData } = require('../../utils/organizationData');
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

module.exports = async function createOrganization({ params }) {
  const service = this;
  const { redis, config } = service;
  const { name: organizationName, active = false, metadata, members } = params;
  const { audience } = config.organizations;

  await Promise.bind(service, organizationName)
    .tap(getOrganizationId)
    .then(ErrorConflictOrganizationExists)
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
  await setOrganizationMetadata.call(service, {
    organizationId,
    audience,
    metadata: {
      $set: Object.assign(metadata[audience] || {}, {
        [ORGANIZATIONS_ID_FIELD]: organizationId,
        [ORGANIZATIONS_NAME_FIELD]: organizationName,
        [ORGANIZATIONS_CREATED_FIELD]: created,
      }),
    },
  });

  if (members) {
    await addOrganizationMembers.call(service, { organizationId, members });
  }

  return getInternalData.call(service, organizationId, true);
};

// init transport
module.exports.transports = [ActionTransport.amqp, ActionTransport.internal];
