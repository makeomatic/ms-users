const Promise = require('bluebird');
const getMetadata = require('../utils/getMetadata.js');
const userExists = require('../utils/userExists.js');

module.exports = function getMetadataAction(message) {
  const { username, audience } = message;

  return Promise
    .bind(this, username)
    .then(userExists)
    .then(() => getMetadata.call(this, username, audience));
};
