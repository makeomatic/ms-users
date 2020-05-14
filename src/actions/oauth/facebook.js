const { ActionTransport } = require('@microfleet/core');
const { ERROR_AUTH_REQUIRED } = require('../../constants');
const formResponse = require('../../auth/oauth/utils/form-oauth-response');

async function facebookCallbackAction(request) {
  return formResponse(request.auth.credentials);
}

async function isAllowed(request) {
  if (!request.auth.credentials) {
    throw ERROR_AUTH_REQUIRED;
  }
}

facebookCallbackAction.allowed = isAllowed;
facebookCallbackAction.auth = 'oauth';
facebookCallbackAction.strategy = 'facebook';
facebookCallbackAction.passAuthError = true;
facebookCallbackAction.transports = [ActionTransport.http];

module.exports = facebookCallbackAction;
