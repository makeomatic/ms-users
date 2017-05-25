const Promise = require('bluebird');
const partial = require('lodash/partial');
const ActionTransport = require('mservice').ActionTransport;

const detach = require('../../utils/oauth/detach.js');
const getInternalData = require('../../utils/getInternalData.js');

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
    .then(partial(detach, username, provider));
};

module.exports.transports = [ActionTransport.amqp, ActionTransport.http];
