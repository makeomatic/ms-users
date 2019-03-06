const Promise = require('bluebird');

const { ActionTransport } = require('@microfleet/core');
const redisKey = require('../../utils/key');
const handlePipeline = require('../../utils/pipelineError');
const setOrganizationMetadata = require('../../utils/setOrganizationMetadata');
const addOrganizationMembers = require('../../utils/addOrganizationMembers');
const { getOrganizationId, getInternalData } = require('../../utils/organization');
const { getUserId } = require('../../utils/userData');
const {
  ErrorConflictOrganizationExists,
  ErrorUserNotFound,
  ORGANIZATIONS_CREATED_FIELD,
  ORGANIZATIONS_NAME_FIELD,
  ORGANIZATIONS_ACTIVE_FLAG,
  ORGANIZATIONS_DATA,
  ORGANIZATIONS_METADATA,
  ORGANIZATIONS_MEMBERS,
  ORGANIZATIONS_NAME_TO_ID,
} = require('../../constants');

module.exports = async function createOrganization({ params }) {
  const service = this;
  const { redis, config } = service;
  const { name: organizationName, active = false, metadata, members } = params;
  const { audience } = config.organizations;

  const organizationExists = await getOrganizationId.call(service, organizationName);
  if (organizationExists) {
    return ErrorConflictOrganizationExists;
  }

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

  if (metadata) {
    await setOrganizationMetadata.call(service, {
      organizationId,
      audience,
      metadata: {
        $set: Object.assign(metadata, {
          [ORGANIZATIONS_CREATED_FIELD]: created,
          [ORGANIZATIONS_NAME_FIELD]: organizationName,
          [ORGANIZATIONS_ACTIVE_FLAG]: Boolean(active),
        }),
      },
    });
  }

  if (members) {
    const checkMembers = members.map(member => Promise.bind(service, member.id).tap(getUserId));
    await Promise.all(checkMembers).catch(ErrorUserNotFound);
    await addOrganizationMembers.call(service, {
      organizationId,
      audience,
      members,
    });
  }

  const organization = await getInternalData.call(service, organizationId, true);
  const organizationMetadata = await redis.hgetall(redisKey(organizationId, ORGANIZATIONS_METADATA, audience));
  const organizationMembersIds = await redis.zscan(redisKey(organizationId, ORGANIZATIONS_MEMBERS), 0);
  let organizationMembersJobs = [];
  if (organizationMembersIds) {
    organizationMembersJobs = organizationMembersIds[1].reduce((acc, memberId, index) => {
      if (index === 0 || index % 2 === 0) {
        acc.push(redis.hgetall(memberId));
      }

      return acc;
    }, []);
  }
  const organizationMembers = await Promise.all(organizationMembersJobs);

  return {
    ...organization,
    metadata: organizationMetadata,
    members: organizationMembers,
  };
};

// init transport
module.exports.transports = [ActionTransport.amqp, ActionTransport.internal];
