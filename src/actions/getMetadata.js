const Promise = require('bluebird');
const Errors = require('common-errors');
const noop = require('lodash/noop');
const identity = require('lodash/identity');
const { ActionTransport } = require('@microfleet/plugin-router');

const get = require('../utils/get-value');
const { getExtendedMetadata } = require('../utils/get-metadata');
const { getInternalData } = require('../utils/user-data');
const isBanned = require('../utils/is-banned');
const { USERS_ALIAS_FIELD, USERS_ID_FIELD } = require('../constants');

const { isArray } = Array;

/**
 * Creates filter for public data based on how we retrieve user information
 * @param  {string[]}  audiences
 * @return {Function}
 */
function isPublic(audiences) {
  return (metadata, username) => {
    // iterate over passed audiences, generally we only retrieve one audience
    // so this check is cheap
    for (const audience of Object.values(audiences)) {
      if (get(metadata, [audience, USERS_ALIAS_FIELD]) === username) {
        return;
      }
    }

    throw new Errors.HttpStatusError(404, 'username was not found');
  };
}

/**
 * Basic function to retrieve metadata for a single user
 * @param  {String} username
 * @return {Promise}
 */
async function retrieveMetadata(username) {
  const { service, audiences, fields, verifyBanned, skipUsernameResolution } = this;
  let internalData;
  let userId;

  if (skipUsernameResolution) {
    userId = username;
  } else {
    internalData = await getInternalData.call(service, username, verifyBanned);

    if (verifyBanned) {
      isBanned(internalData);
    }

    userId = internalData[USERS_ID_FIELD];
  }

  const metadata = await getExtendedMetadata(service, userId, audiences, {
    fields,
    internalData,
  });

  this.filter(metadata, username);

  return metadata;
}

/**
 * If we request only 1 user - return unwrapped array
 * @param  {Array} responses
 * @return {Array|Object}
 */
const extractResponse = (responses) => responses[0];

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
async function getMetadataAction(request) {
  const {
    audience: _audience,
    username: _username,
    public: isPublicResponse,
    includingBanned,
    fields,
    skipUsernameResolution,
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
    verifyBanned: includingBanned === false,
    service: this,
    skipUsernameResolution,
  };

  const response = await Promise
    .bind(ctx, usernames)
    .map(retrieveMetadata, { concurrency: 50 });

  return unnest(response);
}

getMetadataAction.transports = [ActionTransport.amqp, ActionTransport.internal];

module.exports = getMetadataAction;
