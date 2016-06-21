const Promise = require('bluebird');
const { User } = require('../model/usermodel');

module.exports = function updateMetadataAction(message) {
  return Promise
    .bind(this, message.username)
    .then(User.getUsername)
    .then(username => ({ ...message, username }))
    .then(message.script ? User.executeUpdateMetaScript : User.setMeta);
};
