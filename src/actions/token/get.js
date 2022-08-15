const { ActionTransport } = require('@microfleet/plugin-router');

const { getUserId } = require('../../utils/userData');
const { getToken: getApiToken } = require('../../utils/api-token');

/**
 * @api {amqp} <prefix>.token.get Get Token information
 * @apiVersion 1.0.0
 * @apiName GetToken
 * @apiGroup Tokens
 *
 * @apiDescription This method allows to retrieve access token information.
 *
 * @apiParam (Payload) {String} username - id of the user
 * @apiParam (Payload) {String} token - used to identify token
 * @apiParam (Payload) {boolean} [sensitive=false] - true, to show sensitive information
 */
async function getToken({ params }) {
  const { username, token, sensitive } = params;

  const userId = await getUserId.call(this, username);
  const tokenBody = `${userId}.${token}`;

  return getApiToken(this, tokenBody, sensitive);
}

getToken.validateResponse = false;
getToken.transports = [ActionTransport.amqp, ActionTransport.internal];

module.exports = getToken;
