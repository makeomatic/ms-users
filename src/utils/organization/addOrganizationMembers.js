/* eslint-disable no-mixed-operators */
const Promise = require('bluebird');
const redisKey = require('../key.js');
const { generateInvite } = require('../../actions/invite');
const handlePipeline = require('../pipelineError.js');
const { ORGANIZATIONS_MEMBERS, USERS_ORGANIZATIONS } = require('../../constants.js');

/**
 * Updates metadata on a organization object
 * @param  {Object} opts
 * @return {Promise}
 */
async function addOrganizationMembers(opts) {
  const { redis } = this;
  const { organizationId, members, organizationName } = opts;

  const membersIdsJob = members.map(member => Promise
    .bind(this, { email: member.email, ctx: { firstName: member.firstName, lastName: member.lastName } })
    .then(generateInvite));
  const invites = await Promise.all(membersIdsJob);
  console.log('invites', invites);

  const pipe = redis.pipeline();

  const membersKey = redisKey(organizationId, ORGANIZATIONS_MEMBERS);
  members.forEach((member) => {
    const memberKey = redisKey(organizationId, ORGANIZATIONS_MEMBERS, member.username);
    const memberOrganizations = redisKey(member.username, USERS_ORGANIZATIONS);
    member.invited = Date.now();
    member.accepted = null;
    member.permissions = member.permissions || [];
    pipe.hmset(memberKey, member);
    pipe.hset(memberOrganizations, organizationName, JSON.stringify(member.permissions));
    pipe.zadd(membersKey, Date.now(), memberKey);
  });

  await pipe.exec().then(handlePipeline);

  return true;
}

module.exports = addOrganizationMembers;
