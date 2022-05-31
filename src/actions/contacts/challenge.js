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
  const { i18nLocale, contact } = params;
  const userId = await getUserId.call(this, params.username);
  const attributes = await contacts.challenge.call(this, { contact, userId, i18nLocale });

  return {
    data: {
      attributes,
    },
  };
};

module.exports.transports = [ActionTransport.amqp, ActionTransport.internal];
