const { ActionTransport } = require('@microfleet/plugin-router');

const { updateUsernameWithToken } = require('../../utils/update-username');

/**
 * @api {amqp} <prefix>.update-username Update Username
 * @apiVersion 1.0.0
 * @apiName UpdateUsername
 * @apiGroup Users
 *
 * @apiDescription Update username using the code that was sent
 * to the user using `update-username.request` action.
 * Currently only the phone is supported.
 *
 * @apiSchema (Payload) {jsonschema=../../../schemas/update-username/update.json} apiParam
 */
module.exports = async function updateUsernameAction(request) {
  const { token, username } = request.params;

  await updateUsernameWithToken(this, token, username);
};

module.exports.transports = [ActionTransport.amqp, ActionTransport.internal];
