const Promise = require('bluebird');
const updateMetadata = require('../utils/updateMetadata.js');
const userExists = require('../utils/userExists.js');

module.exports = function updateMetadataAction(message) {
  return Promise
    .bind(this, message.username)
    .then(userExists)
    .then(username => ({ ...message, username }))
    .then(updateMetadata);
};
