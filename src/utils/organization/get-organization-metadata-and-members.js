const getInternalData = require('./get-internal-data');
const getOrganizationMembers = require('./get-organization-members');
const getOrganizationMetadata = require('./get-organization-metadata');

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
