const { ActionTransport } = require('@microfleet/plugin-router');
const contacts = require('../../utils/contacts');
const { getUserId } = require('../../utils/userData');

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
module.exports = async function challenge({ params }) {
  const userId = await getUserId.call(this, params.username);
  const contact = await contacts.challenge.call(this, { contact: params.contact, userId });

  return {
    data: {
      attributes: contact,
    },
  };
};

module.exports.transports = [ActionTransport.amqp, ActionTransport.internal];
