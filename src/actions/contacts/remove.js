const { ActionTransport } = require('@microfleet/plugin-router');

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
module.exports = async function remove({ params }) {
  const { contact, updateUsername, username } = params;
  const userId = await getUserId.call(this, username);

  return contacts.remove.call(this, {
    contact,
    updateUsername,
    userId,
  });
};

module.exports.transports = [ActionTransport.amqp, ActionTransport.internal];
