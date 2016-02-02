const Promise = require('bluebird');
const updateMetadata = require('../utils/updateMetadata.js');
const userExists = require('../utils/userExists.js');

module.exports = function updateMetadataAction(message) {
  const { username } = message;

  return Promise
    .bind(this, username)
    .then(userExists)
    .return(message)
    .then(updateMetadata);
};
