const { ActionTransport } = require('@microfleet/plugin-router');

const contacts = require('../../utils/contacts');
const { getUserId } = require('../../utils/user-data');

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
module.exports = async function list({ params }) {
  const userId = await getUserId.call(this, params.username);
  const contactList = await contacts.list.call(this, { userId });

  return { data: contactList };
};

module.exports.transports = [ActionTransport.amqp, ActionTransport.internal];
