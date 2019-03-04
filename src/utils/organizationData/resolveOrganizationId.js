const makeKey = require('../key.js');
const {
  ORGANIZATIONS_ID_FIELD,
  ORGANIZATIONS_DATA,
  ORGANIZATIONS_MEMBERS,
} = require('../../constants');

function resolveOrganizationData(response) {
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
      resolvedData[value] = organizationData[index + 1];
    }
  });

  return resolvedData;
}

/**
 * @param {string} id - Identificator of user (should be user id, user name or alias)
 * @param {bool} fetchData - If `true` response will also contain user data
 * @returns {null|object}
 */
function resolveOrganizationId(id, fetchData = false) {
  const { redis } = this;
  const indexPlaceholder = 'organizationId';
  const organizationDataIndex = makeKey(indexPlaceholder, ORGANIZATIONS_DATA);
  const organizationMembersIndex = makeKey(indexPlaceholder, ORGANIZATIONS_MEMBERS);
  const numberOfKeys = 2;

  return redis
    .resolveOrganizationId(
      numberOfKeys,
      organizationDataIndex,
      organizationMembersIndex,
      id,
      fetchData === true ? 1 : 0,
      indexPlaceholder
    )
    .then(resolveOrganizationData);
}

module.exports = resolveOrganizationId;
