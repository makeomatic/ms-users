const getInternalData = require('./get-internal-data');

async function checkOrganizationExists(request) {
  const { organizationId } = request.params;
  await getInternalData.call(this, organizationId, false);
}

module.exports = checkOrganizationExists;
