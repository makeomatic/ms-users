const omit = require('lodash/omit');
const Promise = require('bluebird');
const contacts = require('../../utils/contacts');
const { getUserId } = require('../../utils/userData');

/**
 * @api {amqp} <prefix>.contacts.remove Remove User Contact
 * @apiVersion 1.0.0
 * @apiName Add
 * @apiGroup Users.Contact
 *
 * @apiDescription Interface to remove user contacts
 *
 * @apiParam (Payload) {String} username -
 */
module.exports = function remove(request) {
  return Promise
    .bind(this, request.params.username)
    .then(getUserId)
    .then((userId) => ({ ...omit(request.params, 'username'), userId }))
    .then(contacts.remove);
};

module.exports.transports = [require('@microfleet/core').ActionTransport.amqp];
