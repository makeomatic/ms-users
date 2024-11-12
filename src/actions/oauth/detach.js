const { ActionTransport } = require('@microfleet/plugin-router');

const detach = require('../../auth/oauth/utils/detach');
const { getInternalData } = require('../../utils/user-data');

/**
 * @api {amqp} <prefix>.oauth.detach Detach SSO provider from profile
 * @apiVersion 1.0.0
 * @apiName OauthDetach
 * @apiGroup Users
 *
 * @apiDescription Detach a given SSO account from user profile
 *
 * @apiParam (Payload) {String} provider
 * @apiParam (Payload) {String} username - user's username
 */
async function detachAction(request) {
  const { provider, username } = request.params;

  const internalData = await getInternalData.call(this, username);
  await detach.call(this, provider, internalData);

  return { success: true };
}

detachAction.transports = [ActionTransport.amqp, ActionTransport.internal];

module.exports = detachAction;
