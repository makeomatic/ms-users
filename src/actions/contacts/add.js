const { ActionTransport } = require('@microfleet/plugin-router');
const contacts = require('../../utils/contacts');
const { getUserId } = require('../../utils/user-data');

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
module.exports = async function add({ params: { username, contact, skipChallenge } }) {
  const userId = await getUserId.call(this, username);
  const attributes = await contacts.add.call(this, { contact, userId, skipChallenge });

  return {
    data: {
      attributes,
    },
  };
};

module.exports.transports = [ActionTransport.amqp, ActionTransport.internal];
