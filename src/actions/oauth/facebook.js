const Promise = require('bluebird');
const Errors = require('common-errors');
const tokens = require('../../utils/jwt');

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
  return tokens.sign(facebook)
    .then(token => ({
      token,
      provider: '"facebook"',
    }));
}

function facebookCallbackAction(request) {
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
    .tap((context) => {
      request.renderView = {
        view: 'attached',
        context,
      };
    })
    .return(null);
}

facebookCallbackAction.auth = 'oauth';
facebookCallbackAction.strategy = 'facebook';
facebookCallbackAction.transport = ['http'];
facebookCallbackAction.allowed = (request) => {
  if (!request.auth.credentials) {
    throw new Errors.HttpStatusError(401, 'authentication required');
  }
};

module.exports = facebookCallbackAction;
