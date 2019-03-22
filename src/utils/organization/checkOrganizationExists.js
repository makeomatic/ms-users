const getOrganizationId = require('./getOrganizationId');
const { ErrorOrganizationNotFound } = require('../../constants');

async function checkOrganizationExists({ params }) {
  const { name: organizationName } = params;
  if (!this.locals) {
    this.locals = {};
  }

  this.locals.organizationId = await getOrganizationId.call(this, organizationName);
  if (!this.locals.organizationId) {
    throw ErrorOrganizationNotFound;
  }
}

module.exports = checkOrganizationExists;
