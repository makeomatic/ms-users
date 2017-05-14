const url = require('url');
const Promise = require('bluebird');
const Errors = require('common-errors');
const { signData } = require('../../utils/jwt');

function updateMetadata(facebook, jwt) {
  return this.router.dispatch('users.updateMetadata', {
    headers: {
      jwt,
    },
    params: {
      metadata: {
        $set: { facebook },
      },
    },
  })
  .return({});
}

function getSignedToken(facebook) {
  return Promise.bind(this, facebook)
    .then(signData)
    .then(token => ({
      token,
      provider: 'facebook',
    }));
}

function facebookCallbackAction(request) {
  const { config: { server } } = this;
  const { credentials } = request.auth;

  // input data
  const { provider, token, profile, query } = credentials;
  const { id, displayName, email } = profile;
  const { jwt } = query;

  // compose facebook context
  const facebook = {
    id,
    displayName,
    email,
    provider,
    token,
  };

  return Promise
    .bind(this, [facebook, jwt])
    .spread(jwt ? updateMetadata : getSignedToken)
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
}

facebookCallbackAction.auth = 'oauth';
facebookCallbackAction.strategy = 'facebook';
facebookCallbackAction.transport = ['http'];
facebookCallbackAction.allowed = (request) => {
  const { credentials } = request.auth;

  if (!credentials) {
    throw new Errors.HttpStatusError(401, 'authentication required');
  }
};

module.exports = facebookCallbackAction;
