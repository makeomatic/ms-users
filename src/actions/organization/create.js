const { ActionTransport } = require('@microfleet/core');
const snakeCase = require('lodash/snakeCase');
const redisKey = require('../../utils/key');
const handlePipeline = require('../../utils/pipelineError');
const setOrganizationMetadata = require('../../utils/setOrganizationMetadata');
const addOrganizationMembers = require('../../utils/organization/addOrganizationMembers');
const { getOrganizationId, getOrganizationMetadataAndMembers } = require('../../utils/organization');
const {
  ErrorConflictOrganizationExists,
  ORGANIZATIONS_NAME_FIELD,
  ORGANIZATIONS_ACTIVE_FLAG,
  ORGANIZATIONS_DATA,
  ORGANIZATIONS_NAME_TO_ID,
} = require('../../constants');

async function createOrganization({ params }) {
  const service = this;
  const { redis, config } = service;
  const { name: organizationName, active = false, metadata, members } = params;
  const { audience } = config.organizations;
  const normalizedOrganizationName = snakeCase(organizationName);

  const organizationExists = await getOrganizationId.call(service, organizationName);
  if (organizationExists) {
    throw ErrorConflictOrganizationExists;
  }

  const organizationId = service.flake.next();
  const pipeline = redis.pipeline();
  const basicInfo = {
    [ORGANIZATIONS_NAME_FIELD]: organizationName,
    [ORGANIZATIONS_ACTIVE_FLAG]: active,
  };
  const organizationDataKey = redisKey(organizationId, ORGANIZATIONS_DATA);
  pipeline.hmset(organizationDataKey, basicInfo);
  pipeline.hset(ORGANIZATIONS_NAME_TO_ID, normalizedOrganizationName, organizationId);
  await pipeline.exec().then(handlePipeline);

  if (metadata) {
    await setOrganizationMetadata.call(service, {
      organizationId,
      audience,
      metadata: {
        $set: metadata,
      },
    });
  }

  await addOrganizationMembers.call(service, {
    organizationId,
    organizationName,
    audience,
    members,
  });

  return getOrganizationMetadataAndMembers.call(this, organizationId);
}

createOrganization.auth = 'httpBearer';
createOrganization.transports = [ActionTransport.amqp, ActionTransport.internal];

module.exports = createOrganization;
