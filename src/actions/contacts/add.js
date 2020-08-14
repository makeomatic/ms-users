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
module.exports = async function add({ params }) {
  const userId = await getUserId.call(this, params.username);
  await contacts.checkLimit.call(this, { userId });
  const contact = await contacts.add.call(this, { contact: params.contact, userId });

  return formatData(contact);
};

module.exports.transports = [require('@microfleet/core').ActionTransport.amqp];
