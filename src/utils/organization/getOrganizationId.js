const { ORGANIZATIONS_NAME_TO_ID } = require('../../constants');

function getOrganizationId(organizationName) {
  return this.redis.hget(ORGANIZATIONS_NAME_TO_ID, organizationName);
}

module.exports = getOrganizationId;
