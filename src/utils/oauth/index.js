const fs = require('fs');
const Promise = require('bluebird');
const Errors = require('common-errors');

const get = require('lodash/get');
const forEach = require('lodash/forEach');
const defaults = require('lodash/defaults');

const { Redirect } = require('./errors');

/* eslint-disable */
const _strategies = fs.readdirSync(__dirname + '/strategies').reduce((acc, module) => {
  acc[module.replace(/^(.*).js$/, '$1')] = require(`./strategies/${module}`);
  return acc;
}, {});
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

  return new Promise((resolve, reject) => {
    http.auth.test(strategy, transportRequest, function auth(response, credentials) {
      if (response) {
        const shouldThrow = isError(response);
        const shouldRedirect = isRedirect(response);

        if (shouldThrow) {
          return reject(response);
        }

        if (shouldRedirect) {
          // set redirect uri to rewrite the response in the hapi's preResponse hook
          const redirectUri = transportRequest.redirectUri = get(response, 'headers.location');
          return reject(new Redirect(redirectUri));
        }
      }

      if (!credentials) {
        return reject(new Errors.AuthenticationRequiredError('missed credentials'));
      }

      return resolve(credentials);
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
  const { oauth, http } = config;

  if (!oauth) {
    return null;
  }

  const { providers } = oauth;

  server.ext('onPreResponse', (request, reply) => {
    const { redirectUri, renderView } = request;

    if (redirectUri) {
      return reply.redirect(redirectUri);
    }

    if (renderView) {
      const { view, context } = renderView;
      return reply.view(view, context);
    }

    return reply.continue();
  });

  return server.register([
    require('bell'),
    require('vision'),
  ]).then(() => {
    forEach(providers, (options, name) => {
      const strategy = _strategies[name];

      if (!strategy) {
        throw new Error(`Oauth: unknown strategy ${name}`);
      }

      let provider;
      const { scope, scopeSeparator, ...rest } = options;

      if (strategy.options) {
        const configuredOptions = {
          name,
          scope: stringToArray(scope),
          scopeSeparator,
        };
        provider = defaults(configuredOptions, strategy.options);
      } else {
        // use bell defaults
        provider = name;
      }

      const providerOptions = { provider, ...rest };

      server.auth.strategy(name, 'bell', providerOptions);
    });

    server.views({
      engines: {
        html: require('handlebars'),
      },
      relativeTo: __dirname,
      path: http.templatesPath,
    });

    return server;
  });
};
