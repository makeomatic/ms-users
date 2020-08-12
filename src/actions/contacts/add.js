const omit = require('lodash/omit');
const Promise = require('bluebird');
const contacts = require('../../utils/contacts');
const { getUserId } = require('../../utils/userData');

const formatData = (contact) => ({
  data: {
    attributes: contact,
  },
});

/**
 * @api {amqp} <prefix>.contacts.add Add User Contact
 * @apiVersion 1.0.0
 * @apiName Add
 * @apiGroup Users.Contact
 *
 * @apiDescription Interface to add user contacts
 *
 * @apiParam (Payload) {String} username -
 */
module.exports = function add(request) {
  return Promise
    .bind(this, request.params.username)
    .then(getUserId)
    .then((userId) => ({ ...omit(request.params, 'username'), userId }))
    .then(contacts.add)
    .then(formatData);
};

module.exports.transports = [require('@microfleet/core').ActionTransport.amqp];
