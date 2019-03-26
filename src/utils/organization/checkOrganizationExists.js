const getOrganizationId = require('./getOrganizationId');
const { ErrorOrganizationNotFound } = require('../../constants');

async function checkOrganizationExists(request) {
  const { name: organizationName } = request.params;

  request.locals.organizationId = await getOrganizationId.call(this, organizationName);
  if (!request.locals.organizationId) {
    throw ErrorOrganizationNotFound;
  }
}

module.exports = checkOrganizationExists;
