const {
  USERS_ID_FIELD,
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
  return this.userData.resolveUserIdBuffer(id, fetchData)
    .then(resolveUserData);
}

module.exports = resolveUserId;
