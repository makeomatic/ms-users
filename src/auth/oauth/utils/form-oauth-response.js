const Promise = require('bluebird');
const assert = require('assert');
const { HttpStatusError } = require('common-errors');
const attach = require('./attach');
const providers = require('../providers');
const { getSignedToken } = require('./get-signed-token');

async function formOAuthResponse(request, credentials) {
  const { account, jwt, user } = credentials;

  // logged in, no account provided - bypass
  if (!account && jwt) {
    const { cookies } = this.config.jwt;
    if (cookies.enabled === true) {
      request.transportRequest.setState(cookies.name, jwt, cookies.settings);
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

  if (!account) {
    throw new HttpStatusError(500, 'no account when jwt isn\'t present');
  }

  const { missingPermissions } = account;
  const Provider = providers[account.provider];
  assert(Provider, `${account.provider} is not usable`);
  const accountResponse = Provider.transformAccountToResponseFormat(account);

  const context = await Promise
    .bind(this, [accountResponse, user])
    .spread(user ? attach : getSignedToken);

  return {
    payload: context,
    error: false,
    missingPermissions,
    type: 'ms-users:attached',
    title: `Attached ${account.provider} account`,
  };
}

module.exports = formOAuthResponse;
