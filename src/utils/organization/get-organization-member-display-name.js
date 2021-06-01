const { getMemberData } = require('./get-organization-members');
const { ORGANIZATIONS_MEMBERS } = require('../../constants');
const redisKey = require('../key');

const buildDisplayName = ({ firstName, lastName, username } = {}) => {
  const displayName = [firstName, lastName]
    .join(' ')
    .trim();

  return displayName || username;
};

async function getOrganizationMemberDisplayName(organizationId, userId) {
  const memberKey = redisKey(organizationId, ORGANIZATIONS_MEMBERS, userId);
  const data = await getMemberData.call(this, memberKey);

  return buildDisplayName(data);
}
module.exports = getOrganizationMemberDisplayName;
