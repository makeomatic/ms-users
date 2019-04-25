const getInternalData = require('./getInternalData');
const isBanned = require('../isBanned');

async function getUserId(username, verifyBanned = false) {
  const internalData = await getInternalData
    .call(this, username, verifyBanned);

  if (verifyBanned === true) {
    isBanned(internalData);
  }

  return internalData.id;
}

module.exports = getUserId;
