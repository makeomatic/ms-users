const makeKey = require('../key');
const {
  USERS_ID_FIELD,
  USERS_ALIAS_TO_ID,
  USERS_DATA,
  USERS_SSO_TO_ID,
  USERS_USERNAME_TO_ID,
} = require('../../constants');

function resolveUserData(response) {
  // user not found
  if (response === null) {
    return null;
  }

  const [userId, userData] = response;
  const resolvedData = { [USERS_ID_FIELD]: userId };

  // resolve only id
  if (userData === undefined) {
    return resolvedData;
  }

  userData.forEach((value, index) => {
    if ((index % 2) === 0) {
      resolvedData[value] = userData[index + 1];
    }
  });

  return resolvedData;
}

/**
 * @param {string} id - Identificator of user (should be user id, user name or alias)
 * @param {bool} fetchData - If `true` response will also contain user data
 * @returns {null|object}
 */
function resolveUserId(id, fetchData = false) {
  const { redis } = this;
  const indexPlaceholder = 'userId';
  const userDataIndex = makeKey(indexPlaceholder, USERS_DATA);
  const numberOfKeys = 4;

  return redis
    .resolveUserIdBuffer(
      numberOfKeys,
      userDataIndex,
      USERS_USERNAME_TO_ID,
      USERS_ALIAS_TO_ID,
      USERS_SSO_TO_ID,
      id,
      fetchData === true ? 1 : 0,
      indexPlaceholder
    )
    .then(resolveUserData);
}

module.exports = resolveUserId;
