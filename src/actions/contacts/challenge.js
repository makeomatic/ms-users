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
module.exports = async function challenge({ params }) {
  const userId = await getUserId.call(this, params.username);
  const contact = await contacts.challenge.call(this, { contact: params.contact, userId });

  return formatData(contact);
};

module.exports.transports = [require('@microfleet/core').ActionTransport.amqp];
