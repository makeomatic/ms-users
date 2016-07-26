const Promise = require('bluebird');
const updateMetadata = require('../utils/updateMetadata.js');
const userExists = require('../utils/userExists.js');

/**
 * @api {amqp} <prefix>.updateMetadata Update Metadata
 * @apiVersion 1.0.0
 * @apiName UpdateMetadata
 * @apiGroup Users
 *
 * @apiDescription Interface to update metadata with various features like `replace`, `increment`, `remove` or `script` for
 * custom actions. Supports batch updates for multiple audiences
 *
 * @apiParam (Payload) {String} username - currently only email is supported
 * @apiParam (Payload) {String[]} audience - audience(s) to be updated, must match length of metadata key. If string, metadata must be object
 * @apiParam (Payload) {Object[]} [metadata] - operations to be performed on corresponding audience,
 * 	supports `$set key:value`, `$remove keys[]`, `$incr key:diff`
 * @apiParam (Payload) {Object} [script] - if present will be called with passed metadata keys & username, provides direct scripting access.
 * 	Be careful with granting access to this function.
 */
function updateMetadataAction(request) {
  return Promise
    .bind(this, request.params.username)
    .then(userExists)
    .then(username => ({ ...request.params, username }))
    .then(updateMetadata);
}

module.exports = updateMetadataAction;
