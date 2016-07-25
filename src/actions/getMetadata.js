const { ActionTransport } = require('mservice');
const Promise = require('bluebird');
const Errors = require('common-errors');
const getMetadata = require('../utils/getMetadata.js');
const userExists = require('../utils/userExists.js');
const noop = require('lodash/noop');
const get = require('lodash/get');
const isArray = Array.isArray;
const { USERS_ALIAS_FIELD } = require('../constants.js');

function isPublic(username, audiences) {
  return metadata => {
    let notFound = true;

    // iterate over passed audiences
    audiences.forEach(audience => {
      if (notFound && get(metadata, [audience, USERS_ALIAS_FIELD]) === username) {
        notFound = false;
      }
    });

    if (notFound) {
      throw new Errors.HttpStatusError(404, 'username was not found');
    }
  };
}

/**
 * @api {amqp} <prefix>.getMetadata Retrieve Public Data
 * @apiVersion 1.0.0
 * @apiName getMetadata
 * @apiGroup Users
 *
 * @apiDescription This should be used to retrieve user's publicly available data. It contains 2 modes:
 * data that is available when the user requests data about him or herself and when someone else tries
 * to get data about a given user on the system. For instance, if you want to view someone's public profile
 *
 * @apiParam (Payload) {String} username - user's username, can be `alias` or real `username`.
 * 	If it's a real username - then all the data is returned.
 * @apiParam (Payload) {String[]} audience - which namespace of metadata should be used, can be string or array of strings
 * @apiParam (Payload) {Object} fields - must contain an object of `[audience]: String[]` mapping
 * @apiParam (Payload) {String[]} fields.* - fields to return from a passed audience
 *
 */
function getMetadataAction(request) {
  const { audience: _audience, username, fields } = request.params;
  const audience = isArray(_audience) ? _audience : [_audience];

  return Promise
    .bind(this, username)
    .then(userExists)
    .then(realUsername => [realUsername, audience, fields])
    .spread(getMetadata)
    .tap(request.params.public ? isPublic(username, audience) : noop);
}

getMetadataAction.schema = 'getMetadata';

getMetadataAction.transports = [ActionTransport.amqp];

module.exports = getMetadataAction;
