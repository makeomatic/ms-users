const redisKey = require('../key.js');
const {
  ORGANIZATIONS_ID_FIELD,
  ORGANIZATIONS_DATA,
} = require('../../constants');

function resolveData(response) {
  // user not found
  if (response === null) {
    return null;
  }

  const [organizationId, organizationData] = response;
  const resolvedData = { [ORGANIZATIONS_ID_FIELD]: organizationId };

  // resolve only id
  if (organizationData === undefined) {
    return resolvedData;
  }

  organizationData.forEach((value, index) => {
    if ((index % 2) === 0) {
      resolvedData[value] = JSON.parse(organizationData[index + 1]);
    }
  });

  return resolvedData;
}

/**
 * @param {string} id - Identificator of user (should be user id, user name or alias)
 * @param {bool} fetchData - If `true` response will also contain user data
 * @returns {null|object}
 */
function resolveOrganizationData(id, fetchData = false) {
  const { redis } = this;
  const organizationDataKey = redisKey(id, ORGANIZATIONS_DATA);
  const numberOfKeys = 1;

  return redis
    .resolveOrganization(
      numberOfKeys,
      organizationDataKey,
      id,
      fetchData === true ? 1 : 0
    )
    .then(resolveData);
}

module.exports = resolveOrganizationData;
