const path = require('path');
const glob = require('glob');
const Promise = require('bluebird');
const Errors = require('common-errors');
const is = require('is');

const get = require('lodash/get');
const forEach = require('lodash/forEach');
const defaults = require('lodash/defaults');

const getUid = require('./uid');
const extractJWT = require('./extractJWT');
const getInternalData = require('../getInternalData');

const { Redirect } = require('./errors');
const { USERS_USERNAME_FIELD } = require('../../constants');

const strategies = Object.create(null);
const strategiesFolderPath = path.resolve(__dirname, './strategies');
const strategiesFiles = glob.sync('*.js', { cwd: strategiesFolderPath, matchBase: true });

// remove .js
strategiesFiles.forEach((filename) => {
  // eslint-disable-next-line import/no-dynamic-require
  strategies[filename.slice(0, -3)] = require(path.resolve(strategiesFolderPath, filename));
});

function isRedirect(response) {
  const { statusCode } = response;
  return statusCode === 301 || statusCode === 302;
}

function isError(response) {
  const { statusCode } = response;
  return statusCode >= 400;
}

function loginAttempt(username) {
  const { amqp, config } = this;
  const prefix = get(config, 'router.routes.prefix');
  const audience = get(config, 'jwt.defaultAudience');
  const payload = {
    username,
    audience,
    isSSO: true,
  };

  return amqp.publishAndWait(`${prefix}.login`, payload);
}

function verifyToken(token) {
  const { amqp, config } = this;
  const prefix = get(config, 'router.routes.prefix');
  const audience = get(config, 'jwt.defaultAudience');
  const payload = {
    token,
    audience,
  };

  return amqp.publishAndWait(`${prefix}.verify`, payload);
}

function authHandler(request) {
  const { http } = this;
  const { action, transportRequest } = request;
  const { strategy } = action;

  return Promise
    .fromCallback((callback) => {
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

        const { missingPermissions } = credentials;
        if (missingPermissions) {
          return callback(new Errors.AuthenticationRequiredError(`missing permissions - ${missingPermissions.join(',')}`));
        }

        // set actual strategy for confidence
        credentials.provider = strategy;

        // create uid and inject it inside account && internal data
        const uid = getUid(credentials);
        credentials.uid = uid;
        credentials.profile.uid = uid;
        credentials.internals.uid = uid;

        return callback(null, credentials);
      });
    })
    /**
     * try to login user
     */
    .then((account) => {
      const jwt = extractJWT(transportRequest);

      // validate JWT token if provided
      const checkAuth = jwt ? verifyToken.call(this, jwt)
                            : Promise.resolve(false);

      // check if the profile is already attached to any existing account
      const getUsername = getInternalData.call(this, account.uid)
        .get(USERS_USERNAME_FIELD)
        .catchReturn({ statusCode: 404 }, false);

      return Promise.join(checkAuth, getUsername, (user, username) => {
        // user is authenticated and profile is attached
        if (user && username) {
          throw new Errors.HttpStatusCode(412, 'profile is linked');
        }

        // found a linked user, log in
        if (username) {
          return Promise.bind(this, username).then(loginAttempt);
        }

        return { user, jwt, account };
      });
    });
}

exports.strategies = {
  oauth: authHandler,
};

const stringToArray = (scope, scopeSeparator) => (
  Array.isArray(scope) ? scope : scope.split(scopeSeparator)
);

exports.OauthHandler = function OauthHandler(server, config) {
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

    if (options.enabled === false) {
      return;
    }

    if (!strategy) {
      throw new Error(`OAuth: unknown strategy ${name}`);
    }

    let provider;
    const defaultOptions = strategy.options;
    const { scope, fields, profileHandler, scopeSeparator, apiVersion, enabled, ...rest } = options;

    if (defaultOptions) {
      const configuredOptions = {
        name,
        scope: stringToArray(scope),
        scopeSeparator,
      };

      if (is.fn(defaultOptions)) {
        provider = defaultOptions({ ...configuredOptions, apiVersion, fields, profileHandler });
      } else {
        provider = defaults(configuredOptions, defaultOptions);
      }
    } else {
      // use bell defaults
      provider = name;
    }

    server.auth.strategy(name, 'bell', { provider, ...rest });
  });

  return server;
};
