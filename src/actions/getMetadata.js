const Promise = require('bluebird');
const Errors = require('common-errors');
const getMetadata = require('../utils/getMetadata.js');
const userExists = require('../utils/userExists.js');
const noop = require('lodash/noop');
const identity = require('lodash/identity');
const get = require('lodash/get');
const { USERS_ALIAS_FIELD } = require('../constants.js');

const { isArray } = Array;

/**
 * Creates filter for public data based on how we retrieve user information
 * @param  {Array}  audiences
 * @return {Function}
 */
function isPublic(audiences) {
  return (metadata, username) => {
    let notFound = true;

    // iterate over passed audiences, generally we only retrieve one audience
    // so this check is cheap
    audiences.forEach((audience) => {
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
 * Basic function to retrieve metadata for a single user
 * @param  {String} username
 * @return {Promise}
 */
function retrieveMetadata(username) {
  return Promise
    .bind(this.service, username)
    .then(userExists)
    .then(realUsername => [realUsername, this.audiences, this.fields])
    .spread(getMetadata)
    .tap(metadata => this.filter(metadata, username));
}

/**
 * If we request only 1 user - return unwrapped array
 * @param  {Array} responses
 * @return {Array|Object}
 */
function extractResponse(responses) {
  return responses[0];
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
 * @apiParam (Payload) {String[]} username - user's username, can be `alias` or real `username`.
 *  If it's a real username - then all the data is returned. Can be either String of Array of Strings
 * @apiParam (Payload) {String[]} audience - which namespace of metadata should be used, can be string or array of strings
 * @apiParam (Payload) {Object} fields - must contain an object of `[audience]: String[]` mapping
 * @apiParam (Payload) {String[]} fields.* - fields to return from a passed audience
 *
 */
module.exports = function getMetadataAction(request) {
  const {
    audience: _audience,
    username: _username,
    public: isPublicResponse,
    fields,
  } = request.params;

  const multi = isArray(_username);
  const unnest = multi ? identity : extractResponse;
  const audiences = isArray(_audience) ? _audience : [_audience];
  const usernames = multi ? _username : [_username];
  const filter = isPublicResponse ? isPublic(audiences) : noop;

  const ctx = {
    audiences,
    usernames,
    filter,
    fields,
    service: this,
  };

  return Promise
    .bind(ctx, usernames)
    .map(retrieveMetadata)
    .then(unnest);
};

module.exports.transports = [require('@microfleet/core').ActionTransport.amqp];
