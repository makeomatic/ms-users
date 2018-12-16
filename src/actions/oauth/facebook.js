const { ActionTransport } = require('@microfleet/core');
const Promise = require('bluebird');
const { ERROR_AUTH_REQUIRED } = require('../../constants');
const attach = require('../../auth/oauth/utils/attach');
const { getSignedToken } = require('../../auth/oauth/utils/getSignedToken');

async function facebookCallbackAction(request) {
  const { credentials } = request.auth;
  const { user, account } = credentials;

  // logged in, no account provided - bypass
  if (!account) {
    const { cookies } = this.config.jwt;
    if (cookies.enabled === true) {
      request.transportRequest.setState(cookies.name, credentials.jwt, cookies.settings);
    }

    return {
      payload: {
        ...credentials,
      },
      error: false,
      type: 'ms-users:logged-in',
      title: 'signing in',
    };
  }

  // input data
  // TODO: customize what to encode
  const {
    uid, provider, email, profile, internals, missingPermissions,
  } = account;

  // compose facebook context, would be encoded
  const facebook = {
    uid,
    email,
    provider,
    internals,
    profile: {
      ...profile,
    },
  };

  const context = await Promise
    .bind(this, [facebook, user])
    .spread(user ? attach : getSignedToken);

  return {
    payload: context,
    error: false,
    missingPermissions,
    type: 'ms-users:attached',
    title: `Attached ${provider} account`,
  };
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
