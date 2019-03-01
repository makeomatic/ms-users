const getInternalData = require('./getInternalData');

function getOrganizationId(username) {
  return getInternalData
    .call(this, username, false)
    .get('id');
}

module.exports = getOrganizationId;
