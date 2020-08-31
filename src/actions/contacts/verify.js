const contacts = require('../../utils/contacts');
const { getUserId } = require('../../utils/userData');

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
module.exports = async function verify({ params }) {
  const userId = await getUserId.call(this, params.username);
  const contact = await contacts.verify.call(this, {
    userId,
    contact: params.contact,
    token: params.token,
  });

  return {
    data: {
      attributes: contact,
    },
  };
};

module.exports.transports = [require('@microfleet/core').ActionTransport.amqp];
