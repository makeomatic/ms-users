const Promise = require('bluebird');
const Users = require('../db/adapter');

module.exports = function updateMetadataAction(message) {
  return Promise
    .bind(this, message.username)
    .then(Users.isExists)
    .then(username => ({ ...message, username }))
    .then(Users.updateMetadata);
};
