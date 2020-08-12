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
 * @api {amqp} <prefix>.contacts.challenge Request the "challenge" for the verification
 * @apiVersion 1.0.0
 * @apiName Add
 * @apiGroup Users.Contact
 *
 * @apiDescription Interface request the "challenge" for the verification
 *
 * @apiParam (Payload) {String} username -
 */
module.exports = function challenge(request) {
  return Promise
    .bind(this, request.params.username)
    .then(getUserId)
    .then((userId) => ({ ...omit(request.params, 'username'), userId }))
    .then(contacts.challenge)
    .then(formatData);
};

module.exports.transports = [require('@microfleet/core').ActionTransport.amqp];
