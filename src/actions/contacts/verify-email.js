const { ActionTransport } = require('@microfleet/plugin-router');

const contacts = require('../../utils/contacts');

/**
 * @api {amqp} <prefix>.contacts.verificate
 * @apiVersion 1.0.0
 * @apiName Add
 * @apiGroup Users.Contact
 *
 * @apiDescription Interface request to verificate
 *
 * @apiParam (Payload) {String} secret -
 */
module.exports = async function verifyEmail({ secret }) {
  const contact = await contacts.verifyEmail.call(this, {
    token: secret,
  });

  return {
    data: {
      attributes: contact,
    },
  };
};

module.exports.transports = [ActionTransport.amqp, ActionTransport.internal];
