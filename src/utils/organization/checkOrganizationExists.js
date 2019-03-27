const getInternalData = require('./getInternalData');

async function checkOrganizationExists(request) {
  const { organizationId } = request.params;
  await getInternalData.call(this, organizationId, false);
}

module.exports = checkOrganizationExists;
