const is = require('is');
const getInternalData = require('./get-internal-data');
const isBanned = require('../is-banned');
const { USERS_PASSWORD_FIELD } = require('../../constants');

async function getUserInfo(username, verifyBanned = false, noPasswordCheck = false) {
  const internalData = await getInternalData
    .call(this, username, verifyBanned || noPasswordCheck);

  if (verifyBanned === true) {
    isBanned(internalData);
  }

  return {
    userId: internalData.id,
    ...(
      noPasswordCheck && is.undefined(internalData[USERS_PASSWORD_FIELD]) === true
        ? { noPassword: true }
        : {}
    ),
  };
}

module.exports = getUserInfo;
