const Promise = require('bluebird');
const { User } = require('../model/usermodel');

module.exports = function getMetadataAction(message) {
  const { audience, username, fields } = message;

  return Promise
    .bind(this, username)
    .then(User.getUsername)
    .then(realUsername => [realUsername, audience, fields, message.public])
    .spread(User.getMeta);
};
