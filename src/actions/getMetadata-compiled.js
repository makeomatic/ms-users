'use strict';

const Promise = require('bluebird');
const noop = require('lodash/noop');
const Users = require('../db/adapter');

module.exports = function getMetadataAction(message) {
  const { audience, username, fields } = message;

  return Promise.bind(this, username).then(Users.isExists).then(realUsername => [realUsername, audience, fields]).spread(Users.getMetadata).tap(message.public ? Users.isPublic(username, audience) : noop);
};

//# sourceMappingURL=getMetadata-compiled.js.map