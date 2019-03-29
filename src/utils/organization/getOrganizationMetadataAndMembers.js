const getInternalData = require('./getInternalData');
const getOrganizationMembers = require('./getOrganizationMembers');
const getOrganizationMetadata = require('./getOrganizationMetadata');

async function getOrganizationMetadataAndMembers(organizationId) {
  const organization = await getInternalData.call(this, organizationId, true);
  const members = await getOrganizationMembers.call(this, organizationId);
  const metadata = await getOrganizationMetadata.call(this, organizationId);

  return {
    ...organization,
    metadata,
    members,
  };
}

module.exports = getOrganizationMetadataAndMembers;
