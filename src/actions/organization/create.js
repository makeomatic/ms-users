const Promise = require('bluebird');

const { ActionTransport } = require('@microfleet/core');
const redisKey = require('../../utils/key');
const handlePipeline = require('../../utils/pipelineError');
const setOrganizationMetadata = require('../../utils/setOrganizationMetadata');
const addOrganizationMembers = require('../../utils/addOrganizationMembers');
const { getOrganizationId, getOrganizationMetadataAndMembers } = require('../../utils/organization');
const { getUserId } = require('../../utils/userData');
const {
  ErrorConflictOrganizationExists,
  ErrorUserNotFound,
  ORGANIZATIONS_NAME_FIELD,
  ORGANIZATIONS_ACTIVE_FLAG,
  ORGANIZATIONS_DATA,
  ORGANIZATIONS_NAME_TO_ID,
} = require('../../constants');

module.exports = async function createOrganization({ params }) {
  const service = this;
  const { redis, config } = service;
  const { name: organizationName, active = false, metadata, members } = params;
  const { audience } = config.organizations;

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
  pipeline.hset(ORGANIZATIONS_NAME_TO_ID, organizationName, organizationId);
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

  if (members) {
    await addOrganizationMembers.call(service, {
      organizationId,
      organizationName,
      audience,
      members,
    });
  }

  return getOrganizationMetadataAndMembers.call(this, organizationId);
};

// init transport
module.exports.transports = [ActionTransport.amqp, ActionTransport.internal];
