const Promise = require('bluebird');
const get = require('lodash/get');
const identity = require('lodash/identity');
const { HttpStatusError } = require('common-errors');
const {
  POLICY_AUTH_REQUIRED,
  POLICY_AUTH_OPTIONAL,
  POLICY_AUTH_TRY,
} = require('../constants');

function verifyUser(token, audience) {
  if (!token) {
    throw new HttpStatusError(401, 'token is required');
  }

  return this.router.dispatch('users.verify', { token, audience });
}

function checkAuth(policy) {
  return (err) => {
    switch (policy) {
      // skip if auth failed
      case POLICY_AUTH_TRY:
        return true;

      // throw error
      case POLICY_AUTH_OPTIONAL:
      case POLICY_AUTH_REQUIRED:
      default:
        throw err;
    }
  };
}

function handleAuthSuccess(request, callback = identity) {
  return credentials => callback(request, credentials);
}

module.exports = function jwtAuthStrategy(request) {
  const policy = get(request, 'action.policy', false);

  // skip auth check if no auth required
  if (!policy) {
    return Promise.resolve(null);
  }

  const token = get(request, 'headers.jwt', null);
  const audience = get(request, 'headers.audience', undefined);
  const onAuthSuccess = get(request, 'action.onAuthSuccess');

  return Promise.bind(this, [token, audience])
    .spread(verifyUser)
    .tap(checkAuth(policy))
    .tap(handleAuthSuccess(request, onAuthSuccess));
};
