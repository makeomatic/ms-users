const omit = require('lodash/omit');
const Promise = require('bluebird');
const contacts = require('../../utils/contacts');
const { getUserId } = require('../../utils/userData');

const formatData = (contacts) => ({
  data: contacts
})

/**
 * @api {amqp} <prefix>.contacts.list User Contact list
 * @apiVersion 1.0.0
 * @apiName Add
 * @apiGroup Users.Contact
 *
 * @apiDescription Interface to get user contacts list
 *
 * @apiParam (Payload) {String} username -
 */
module.exports = function list(request) {
  return Promise
    .bind(this, request.params.username)
    .then(getUserId)
    .then((userId) => ({ ...omit(request.params, 'username'), userId }))
    .then(contacts.list)
    .then(formatData);
};

module.exports.transports = [require('@microfleet/core').ActionTransport.amqp];
