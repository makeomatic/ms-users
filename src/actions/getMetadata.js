const Promise = require('bluebird');
const getMetadata = require('../utils/getMetadata.js');
const userExists = require('../utils/userExists.js');

module.exports = function getMetadataAction(message) {
  const { audience } = message;

  return Promise
    .bind(this, message.username)
    .then(userExists)
    .then(username => [username, audience])
    .spread(getMetadata);
};
