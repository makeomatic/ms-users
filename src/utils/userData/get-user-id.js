const getInternalData = require('./get-internal-data');
const isBanned = require('../is-banned');

async function getUserId(username, verifyBanned = false) {
  const internalData = await getInternalData
    .call(this, username, verifyBanned);

  if (verifyBanned === true) {
    isBanned(internalData);
  }

  return internalData.id;
}

module.exports = getUserId;
