const path = require('path');
const glob = require('glob');
const Promise = require('bluebird');
const Errors = require('common-errors');

const get = require('lodash/get');
const forEach = require('lodash/forEach');
const defaults = require('lodash/defaults');
const isFunction = require('lodash/isFunction');

const { Redirect } = require('./errors');

/* eslint-disable */
const strategies = Object.create(null);
const strategiesFolderPath = path.resolve(__dirname, '/strategies');
const strategiesFiles = glob.sync('*.js', { cwd: strategiesFolderPath, mathBase: true });

strategiesFiles.forEach(filename => {
  // remove .js
  strategies[filename.slice(0, -3)] = require(filename);
});
/* eslint-enable */

function isRedirect(response) {
  const { statusCode } = response;
  return statusCode === 301 || statusCode === 302;
}

function isError(response) {
  const { statusCode } = response;
  return statusCode >= 400;
}

function authHandler(request) {
  const { http } = this;
  const { action, transportRequest } = request;
  const { strategy } = action;

  return Promise.fromCallback((callback) => {
    http.auth.test(strategy, transportRequest, function auth(response, credentials) {
      if (response) {
        const shouldThrow = isError(response);
        const shouldRedirect = isRedirect(response);

        if (shouldThrow) {
          return callback(response);
        }

        if (shouldRedirect) {
          // set redirect uri to rewrite the response in the hapi's preResponse hook
          const redirectUri = transportRequest.redirectUri = get(response, 'headers.location');
          return callback(new Redirect(redirectUri));
        }
      }

      if (!credentials) {
        return callback(new Errors.AuthenticationRequiredError('missed credentials'));
      }

      return callback(null, credentials);
    });
  });
}

module.exports.strategies = {
  oauth: authHandler,
};

function stringToArray(scope, scopeSeparator) {
  return Array.isArray(scope) ? scope : scope.split(scopeSeparator);
}

module.exports.OauthHandler = function OauthHandler(server, config) {
  const { oauth } = config;

  if (!oauth) {
    return null;
  }

  const { providers } = oauth;

  server.ext('onPreResponse', (request, reply) => {
    const { redirectUri } = request;

    if (redirectUri) {
      return reply.redirect(redirectUri);
    }

    return reply.continue();
  });

  forEach(providers, (options, name) => {
    const strategy = strategies[name];

    if (!strategy) {
      throw new Error(`Oauth: unknown strategy ${name}`);
    }

    let provider;
    const defaultOptions = strategy.options;
    const { scope, scopeSeparator, apiVersion, ...rest } = options;

    if (defaultOptions) {
      const configuredOptions = {
        name,
        scope: stringToArray(scope),
        scopeSeparator,
      };

      if (isFunction(defaultOptions)) {
        provider = defaultOptions({ ...configuredOptions, apiVersion });
      } else {
        provider = defaults(configuredOptions, defaultOptions);
      }
    } else {
      // use bell defaults
      provider = name;
    }

    const providerOptions = { provider, ...rest };

    server.auth.strategy(name, 'bell', providerOptions);
  });

  return server;
};
