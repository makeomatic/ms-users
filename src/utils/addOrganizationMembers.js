/* eslint-disable no-mixed-operators */
const Promise = require('bluebird');
const redisKey = require('../utils/key.js');
const generateEmail = require('../utils/challenges/email/generate.js');
const handlePipeline = require('../utils/pipelineError.js');
const {
  ORGANIZATIONS_MEMBERS,
  USERS_ORGANIZATIONS,
  INVITATIONS_INDEX,
  TOKEN_METADATA_FIELD_METADATA,
  TOKEN_METADATA_FIELD_CONTEXT,
  TOKEN_METADATA_FIELD_SENDED_AT,
  USERS_ACTION_INVITE,
} = require('../constants.js');
const { getUserId } = require('./userData');

/**
 * Updates metadata on a organization object
 * @param  {Object} opts
 * @return {Promise}
 */
async function addOrganizationMembers(opts) {
  const { redis, tokenManager } = this;
  const { organizationId, members, organizationName } = opts;

  const membersIdsJob = members.map(member => Promise
    .bind(this, member.username)
    .then(getUserId)
    .catch(() => {
      return tokenManager
        .create({
          id: member.username,
          action: USERS_ACTION_INVITE,
          regenerate: true,
          ttl: 0, // defaults to never expiring
          throttle: 0, // defaults to no throttle
          metadata: {
            [TOKEN_METADATA_FIELD_METADATA]: {},
            [TOKEN_METADATA_FIELD_CONTEXT]: {},
            [TOKEN_METADATA_FIELD_SENDED_AT]: Date.now(),
          },
        })
        .then(token => Promise
          .bind(this, [member.username, USERS_ACTION_INVITE, { token }, { send: true }, {}])
          .spread(generateEmail)
          .tap(() => redis.sadd(INVITATIONS_INDEX, member.username)));
    }));
  const membersIds = await Promise.all(membersIdsJob);
  console.log('membersIds', membersIds)

  // if we have meta, then we can
  if (members) {
    const pipe = redis.pipeline();

    const membersKey = redisKey(organizationId, ORGANIZATIONS_MEMBERS);
    members.forEach((member, idx) => {
      member.id = membersIds[idx];
      const memberKey = redisKey(organizationId, ORGANIZATIONS_MEMBERS, member.id);
      const memberOrganizations = redisKey(member.id, USERS_ORGANIZATIONS);
      member.invited = Date.now();
      member.accepted = null;
      member.permissions = member.permissions || [];
      pipe.hmset(memberKey, member);
      pipe.hset(memberOrganizations, organizationName, JSON.stringify(member.permissions));
      pipe.zadd(membersKey, Date.now(), memberKey);
    });

    await pipe.exec().then(handlePipeline);
  }

  return true;
}

module.exports = addOrganizationMembers;
