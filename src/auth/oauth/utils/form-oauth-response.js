const assert = require('assert');
const { HttpStatusError } = require('common-errors');
const attach = require('./attach');
const providers = require('../providers');
const { getSignedToken } = require('./get-signed-token');

/**
 * @param {Service} ctx
 * @param {ServiceRequest} request
 * @param {{ account: any, jwt: string, user: any }} credentials
 */
async function formOAuthResponse(ctx, request, credentials) {
  const { account, jwt, user } = credentials;

  // logged in, no account provided - bypass
  if (!account && jwt) {
    const { cookies } = ctx.config.jwt;
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

  const context = user
    ? attach.call(ctx, accountResponse, user)
    : getSignedToken.call(ctx, accountResponse);

  return {
    payload: await context,
    error: false,
    missingPermissions,
    type: user ? 'ms-users:attached' : 'ms-users:signed',
    title: `Attached ${account.provider} account`,
  };
}

module.exports = formOAuthResponse;
