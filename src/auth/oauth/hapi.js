const is = require('is');
const assert = require('assert');
const defaults = require('lodash/defaults');
const { providers: Providers } = require('@hapi/bell');
const strategies = require('./providers');

// helpers
const { isArray } = Array;
const stringToArray = (scope, scopeSeparator) => (isArray(scope) ? scope : scope.split(scopeSeparator));
const hapiOauthHandler = (request, h) => {
  const { redirectUri } = request.response;

  // redirect if redirectURI is present
  if (redirectUri) {
    return h.redirect(redirectUri);
  }

  return h.continue;
};

/**
 * This function initiates bell plugin strategies on hapi.js webserver
 * @param {Hapi} server
 * @param {Objecr} config
 */
module.exports = function OauthHandler(server, config) {
  assert.ok(config.oauth, 'oauth configuration must be present');
  assert.ok(config.oauth.providers, 'oauth configuration must include providers');

  server.ext('onPreResponse', hapiOauthHandler);

  server.app.oauthProviderSettings = Object.create(null);

  for (const [name, options] of Object.entries(config.oauth.providers)) {
    const strategy = strategies[name];

    if (options.enabled === false) {
      continue; // eslint-disable-line no-continue
    }

    assert(strategy, new Error(`OAuth: unknown strategy ${name}`));

    let provider;
    const defaultOptions = strategy.options;
    const {
      scope,
      fields,
      profileHandler,
      scopeSeparator,
      apiVersion,
      enabled,
      retryOnMissingPermissions,
      isSameSite,
      ...rest
    } = options;

    // make sure runtime params are allowed in we want to retry as we need to defined dynamic
    // redirect params
    if (retryOnMissingPermissions === true) {
      rest.allowRuntimeProviderParams = true;
    }

    if (defaultOptions) {
      const configuredOptions = {
        name,
        scope: stringToArray(scope),
        scopeSeparator,
      };

      if (is.fn(defaultOptions)) {
        provider = defaultOptions({
          ...configuredOptions, apiVersion, fields, profileHandler,
        });
      } else {
        provider = defaults(configuredOptions, defaultOptions);
      }
    } else {
      // use bell defaults
      provider = name;
    }

    // settings obj
    const settings = { provider, ...rest };

    // init strategy
    server.auth.strategy(name, 'bell', settings);

    // https://github.com/hapijs/bell/blob/master/lib/index.js#L125-L135
    // repeats the code from here to get another settings object and reuse it
    // this doesn't set defaults, but we don't need them either
    if (typeof settings.provider === 'object') {
      settings.name = settings.provider.name || 'custom';
    } else {
      settings.name = settings.provider;
      settings.provider = Providers[settings.provider].call(null, settings.config);
    }

    // to be reused later via service.oauth.app.oauthProviderSettings[provider]
    server.app.oauthProviderSettings[name] = settings;

    if (isSameSite || isSameSite === false) {
      // NOTE: this overwrites the default from bell
      // must be specified, defaults to mf_bfb
      server.states.cookies[rest.cookie].isSameSite = rest.isSameSite;
    }
  }

  return server;
};
