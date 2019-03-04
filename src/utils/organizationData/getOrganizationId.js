const getInternalData = require('./getInternalData');

function getOrganizationId(organizationName) {
  return getInternalData
    .call(this, organizationName, false)
    .get('id');
}

module.exports = getOrganizationId;
