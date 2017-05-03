const Promise = require('bluebird');
const get = require('lodash/get');
const identity = require('lodash/identity');
const constant = require('lodash/constant');
const { HttpStatusError } = require('common-errors');
const {
  POLICY_AUTH_REQUIRED,
  POLICY_AUTH_OPTIONAL,
  POLICY_AUTH_TRY,
} = require('../constants');

const policyTry = constant(true);
const policyOptionalAndRequired = (err) => { throw err; };

const checkAuth = {
  [POLICY_AUTH_TRY]: policyTry,
  [POLICY_AUTH_OPTIONAL]: policyOptionalAndRequired,
  [POLICY_AUTH_REQUIRED]: policyOptionalAndRequired,
};

function verifyUser(token, audience) {
  const { prefix } = this.config.router;

  if (!token) {
    throw new HttpStatusError(401, 'token is required');
  }

  return this.amqp.publishAndWait(`${prefix}.verify`, { token, audience });
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
  const checkAuthPolicy = checkAuth[policy] || policyOptionalAndRequired;

  return Promise.bind(this, [token, audience])
    .spread(verifyUser)
    .tap(checkAuthPolicy)
    .tap(handleAuthSuccess(request, onAuthSuccess));
};
