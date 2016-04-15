const Promise = require('bluebird');
const Errors = require('common-errors');
const getMetadata = require('../utils/getMetadata.js');
const userExists = require('../utils/userExists.js');
const noop = require('lodash/noop');
const get = require('lodash/get');
const { USERS_ALIAS_FIELD } = require('../constants.js');

function isPublic(username, audience) {
  return metadata => {
    if (get(metadata, [audience, USERS_ALIAS_FIELD]) === username) {
      return;
    }

    throw new Errors.HttpStatusError(404, 'username was not found');
  };
}

module.exports = function getMetadataAction(message) {
  const { audience, username, fields } = message;

  return Promise
    .bind(this, username)
    .then(userExists)
    .then(realUsername => [realUsername, audience, fields])
    .spread(getMetadata)
    .tap(message.public ? isPublic(username, audience) : noop);
};
