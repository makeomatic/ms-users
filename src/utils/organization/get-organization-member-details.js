const { getMemberData } = require('./get-organization-members');
const { ORGANIZATIONS_MEMBERS } = require('../../constants');
const redisKey = require('../key');

async function getOrganizationMemberDetails(organizationId, userId) {
  const memberKey = redisKey(organizationId, ORGANIZATIONS_MEMBERS, userId);
  const data = await getMemberData.call(this, memberKey);

  const { accepted } = data || {};

  return {
    joinedAt: accepted,
  };
}
module.exports = getOrganizationMemberDetails;
