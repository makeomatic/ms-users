const { ActionTransport } = require('@microfleet/plugin-router');

const { ERROR_AUTH_REQUIRED } = require('../../constants');
const formOauthResponse = require('../../auth/oauth/utils/form-oauth-response');

async function appleCallbackAction(request) {
  return formOauthResponse(this, request, request.auth.credentials);
}

async function isAllowed(request) {
  const { auth, log, query } = request;
  const { credentials } = auth;
  const { user } = query;

  if (!credentials) {
    throw ERROR_AUTH_REQUIRED;
  }

  if (user !== undefined) {
    try {
      const { name } = JSON.parse(user);

      if (name !== undefined) {
        const { account: { profile } } = credentials;
        const { firstName, lastName } = name;

        profile.displayName = `${firstName} ${lastName}`;
        profile.name = {
          first: firstName,
          last: lastName,
        };
      }
    } catch (err) {
      log.error({ err, message: 'Failed to parse user data from apple' });
    }
  }
}

appleCallbackAction.allowed = isAllowed;
appleCallbackAction.auth = 'oauth';
appleCallbackAction.strategy = 'apple';
appleCallbackAction.passAuthError = true;
appleCallbackAction.transports = [ActionTransport.http];

module.exports = appleCallbackAction;
