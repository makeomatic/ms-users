const url = require('url');
const Promise = require('bluebird');
const Errors = require('common-errors');

const attach = require('../../utils/oauth/attach');
const getSignedToken = require('../../utils/oauth/getSignedToken');

module.exports = function facebookCallbackAction(request) {
  const { config: { server } } = this;
  const { credentials } = request.auth;
  const { user, account } = credentials;

  // logged in, no account provided - bypass
  if (!account) {
    return Promise.resolve(credentials);
  }

  // input data
  // TODO customize what to encode
  const { uid, provider, email, profile, internals } = account;

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
    .then((context) => {
      const targetOrigin = url.format({
        port: server.port,
        host: server.host,
        protocol: server.proto,
      });

      return request.transportRequest.sendView('providerAttached', {
        targetOrigin,
        ...context,
      });
    });
};

module.exports.allowed = function isAllowed(request) {
  if (!request.auth.credentials) {
    throw new Errors.HttpStatusError(401, 'authentication required');
  }
};

module.exports.auth = 'oauth';
module.exports.strategy = 'facebook';
module.exports.transports = [require('mservice').ActionTransport.http];
