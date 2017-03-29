const fs = require('fs');
const makeKey = require('../key.js');
const Promise = require('bluebird');
const {
  USERS_ID_FIELD,
  USERS_ALIAS_TO_ID,
  USERS_DATA,
  USERS_USERNAME_TO_ID,
} = require('../../constants.js');

const lua = fs.readFileSync(`${__dirname}/resolveUserId.lua`, 'utf8');

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
};

/**
 * @param {string} id - Identificator of user (should be user id, user name or alias)
 * @param {bool} fetchData - If `true` response will also contain user data
 * @returns {null|object}
 */
function resolveUserId(id, fetchData = false) {
  const { redis } = this;
  const indexPlaceholder = 'userId';
  const userDataIndex = makeKey(indexPlaceholder, USERS_DATA);

  // @TODO may be it should be moved to the application bootstrap
  if (redis.resolveUserId === undefined) {
    redis.defineCommand('resolveUserId', {
      lua,
      numberOfKeys: 3,
    });
  }

  return redis
    .resolveUserId(
      userDataIndex, USERS_USERNAME_TO_ID, USERS_ALIAS_TO_ID, id, fetchData, indexPlaceholder
    )
    .then(resolveUserData);
}

module.exports = resolveUserId;
