const Promise = require('bluebird');
const isPublic = require('../utils/isPublic');
const noop = require('lodash/noop');
const { User } = require('../model/usermodel');

const isArray = Array.isArray;

module.exports = function getMetadataAction(message) {
  const { audience: _audience, username, fields } = message;
  const audience = isArray(_audience) ? _audience : [_audience];

  return Promise
    .bind(this, username)
    .then(User.getUsername)
    .then(realUsername => [realUsername, audience, fields])
    .spread(User.getMeta)
    .tap(message.public ? isPublic(username, audience) : noop);
};
