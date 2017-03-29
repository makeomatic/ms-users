const getInternalData = require('./getInternalData');

function userExists(username) {
  return getInternalData
    .call(this, username, false)
    .get('id');
};

module.exports = userExists;
