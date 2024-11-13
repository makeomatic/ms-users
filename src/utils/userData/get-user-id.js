const getInternalData = require('./get-internal-data');

async function getUserId(username) {
  const internalData = await getInternalData.call(this, username, false);

  return internalData.id;
}

module.exports = getUserId;
