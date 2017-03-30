const getInternalData = require('./getInternalData');

function getUserId(username) {
  return getInternalData
    .call(this, username, false)
    .get('id');
}

module.exports = getUserId;
