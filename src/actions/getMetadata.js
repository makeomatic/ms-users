const Promise = require('bluebird');
const { User } = require('../model/usermodel');
const { ModelError } = require('../model/modelError');

module.exports = function getMetadataAction(message) {
  const { audience, username, fields } = message;

  return Promise
    .bind(this, username)
    .then(User.getUsername)
    .then(realUsername => [realUsername, audience, fields, message.public])
    .spread(User.getMeta)
    .catch(e => { throw (e instanceof ModelError ? e : e.mapToHttp); });
};
