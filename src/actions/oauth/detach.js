const Promise = require('bluebird');
const partial = require('lodash/partial');
const { ActionTransport } = require('@microfleet/core');

const detach = require('../../auth/oauth/utils/detach');
const getInternalData = require('../../utils/getInternalData');

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
module.exports = function detachAction(request) {
  const { provider, username } = request.params;

  return Promise.bind(this, username)
    .then(getInternalData)
    .then(partial(detach, username, provider))
    .return({ success: true });
};

module.exports.transports = [ActionTransport.amqp];
