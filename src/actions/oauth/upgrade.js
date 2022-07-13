const { strict: assert } = require('assert');

const { ActionTransport } = require('@microfleet/plugin-router');

const { oauthVerification, mserviceVerification } = require('../../auth/oauth');
const formOAuthResponse = require('../../auth/oauth/utils/form-oauth-response');
const appleStrategy = require('../../auth/oauth/strategies/apple');

/**
 * @api {amqp} <prefix>.oauth.upgrade Upgardes existing SSO token to service-verified token
 * @apiVersion 1.0.0
 * @apiName OauthUpgrade
 * @apiGroup Users
 *
 * @apiDescription Upgrades existing SSO token of a supportted provider to service-verified token
 * erroring out if account associated with this token is already linked to an account in the system
 *
 * @apiParam (Payload) {String="facebook"} provider
 * @apiParam (Payload) {String} token - sso token
 * @apiParam (Payload) {String} isStatelessAuth - use stateless JWT tokens when they are optional
 */
async function upgrade(request) {
  const { transportRequest, params, query } = request;
  const { provider, token, isStatelessAuth } = params;

  // fetch settings, otherwise provider is not supported
  const providerSettings = this.oauth.app.oauthProviderSettings[provider];
  assert(providerSettings, 'provider is not supported');
  assert(providerSettings.provider && typeof providerSettings.provider === 'object', 'provider doesnt support token upgrading');

  // profile fetcher
  const { profile } = providerSettings.provider;
  assert.strictEqual(typeof profile, 'function', 'provider doesnt support token upgrading');

  // retrieves requested profile
  if (params.jwt) {
    query.jwt = params.jwt;
  }

  const credentials = provider === 'apple'
    ? await appleStrategy.upgradeAppleCode({
      query,
      providerSettings,
      code: token,
      redirectUrl: transportRequest.url.href.replace(/\/upgrade$/, '/apple').replace(/^http:\/\//, 'https://'),
    })
    : await profile.call(providerSettings, { token, query });

  // ensure its a shallow copy as we will mutate it later
  const oauthConfig = { ...this.config.oauth.providers[provider] };

  // similar context to regular oauth requests
  const ctx = {
    service: this,
    transportRequest,
    config: oauthConfig,
    strategy: provider,
  };

  // as this is not intended to be called from the browser we do not want any redirects going out
  if (oauthConfig.retryOnMissingPermissions !== false) {
    oauthConfig.retryOnMissingPermissions = false;
  }

  const verifiedCredentials = oauthVerification(ctx, null, credentials);
  const associatedUserData = await mserviceVerification(ctx, verifiedCredentials, isStatelessAuth);

  // at that point we can have the following:
  // 1. account linked, jwt wasnt passed - sign in information under `associatedUserData.user`
  // 2. account not linked, jwt passed - user information + credentials - need to link at that point (?)
  // 3. not linked, no jwt - only fb credentials - encode token for future use in registration
  return formOAuthResponse(this, request, associatedUserData);
}

upgrade.transports = [ActionTransport.http];
upgrade.transportOptions = {
  [ActionTransport.http]: {
    methods: ['post'],
  },
};

module.exports = upgrade;
