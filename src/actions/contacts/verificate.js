const omit = require('lodash/omit');
const Promise = require('bluebird');
const contacts = require('../../utils/contacts');
const { getUserId } = require('../../utils/userData');

const formatData = (contact) => ({
  data: {
    attributes: contact
  }
})

/**
 * @api {amqp} <prefix>.contacts.verificate
 * @apiVersion 1.0.0
 * @apiName Add
 * @apiGroup Users.Contact
 *
 * @apiDescription Interface request to verificate
 *
 * @apiParam (Payload) {String} username -
 */
module.exports = function verificate(request) {
  return Promise
    .bind(this, request.params.username)
    .then(getUserId)
    .then((userId) => ({ ...omit(request.params, 'username'), userId }))
    .then(contacts.verify)
    .then(formatData);
};

module.exports.transports = [require('@microfleet/core').ActionTransport.amqp];
