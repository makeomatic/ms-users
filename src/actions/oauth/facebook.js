const Promise = require('bluebird');
const Errors = require('common-errors');

const attach = require('../../auth/oauth/utils/attach');
const getSignedToken = require('../../auth/oauth/utils/getSignedToken');

module.exports = function facebookCallbackAction(request) {
  const { credentials } = request.auth;
  const { user, account } = credentials;

  // logged in, no account provided - bypass
  if (!account) {
    const cookies = this.config.jwt.cookies;
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
  const { uid, provider, email, profile, internals, missingPermissions } = account;

  // compose facebook context, would be encoded
  const facebook = {
    uid,
    email,
    profile,
    provider,
    internals,
  };

  return Promise
    .bind(this, [facebook, user])
    .spread(user ? attach : getSignedToken)
    .then(context => ({
      payload: context,
      error: false,
      missingPermissions,
      type: 'ms-users:attached',
      title: `Attached ${provider} account`,
    }));
};

module.exports.allowed = function isAllowed(request) {
  if (!request.auth.credentials) {
    throw new Errors.HttpStatusError(401, 'authentication required');
  }
};

module.exports.auth = 'oauth';
module.exports.strategy = 'facebook';
module.exports.passAuthError = true;
module.exports.transports = [require('@microfleet/core').ActionTransport.http];
