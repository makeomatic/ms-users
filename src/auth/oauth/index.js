const Promise = require('bluebird');
const Errors = require('common-errors');
const get = require('lodash/get');
const partial = require('lodash/partial');

const getUid = require('./utils/uid');
const refresh = require('./utils/refresh');
const extractJWT = require('./utils/extractJWT');
const getInternalData = require('../../utils/getInternalData');

const { Redirect } = require('./utils/errors');
const { USERS_USERNAME_FIELD } = require('../../constants');

// helpers
const isRedirect = ({ statusCode }) => statusCode === 301 || statusCode === 302;
const isError = ({ statusCode }) => statusCode >= 400;

/**
 * Attempts to sign in with a registered user
 * @param  {string} username
 * @returns {Promise}
 */
function loginAttempt(username) {
  const { amqp, config } = this;
  const prefix = config.router.routes.prefix;
  const audience = config.jwt.defaultAudience;
  const payload = {
    username,
    audience,
    isSSO: true,
  };

  return amqp.publishAndWait(`${prefix}.login`, payload);
}

/**
 * Performs JWT token verification
 * @param  {string} token
 * @returns {Promise}
 */
function verifyToken(token) {
  const { amqp, config } = this;
  const prefix = config.router.routes.prefix;
  const audience = config.jwt.defaultAudience;
  const payload = {
    token,
    audience,
  };

  return amqp.publishAndWait(`${prefix}.verify`, payload);
}

/**
 * Authentication handler
 * @param  {HttpClientResponse} response
 * @param  {Object} credentials
 * @returns {Array<HttpClientResponse, Credentials>}
 */
function oauthVerification(response, credentials) {
  if (response) {
    const shouldThrow = isError(response);
    const shouldRedirect = isRedirect(response);

    if (shouldThrow) {
      return Promise.reject(response);
    }

    if (shouldRedirect) {
      // set redirect uri to rewrite the response in the hapi's preResponse hook
      const redirectUri = this.transportRequest.redirectUri = get(response, 'headers.location');
      return Promise.reject(new Redirect(redirectUri));
    }
  }

  if (!credentials) {
    return Promise.reject(new Errors.AuthenticationRequiredError('missed credentials'));
  }

  const { missingPermissions } = credentials;
  if (missingPermissions) {
    return Promise.reject(new Errors.AuthenticationRequiredError(`missing permissions - ${missingPermissions.join(',')}`));
  }

  // set actual strategy for confidence
  credentials.provider = this.strategy;

  // create uid and inject it inside account && internal data
  const uid = getUid(credentials);
  credentials.uid = uid;
  credentials.profile.uid = uid;
  credentials.internals.uid = uid;

  return credentials;
}

function mserviceVerification(credentials) {
  // query on initial request is recorded and is available via credentials.queyr
  // https://github.com/hapijs/bell/blob/63603c9e897f3607efeeca87b6ef3c02b939884b/lib/oauth.js#L261
  const oauthConfig = this.service.config.oauth;
  const jwt = extractJWT(this.transportRequest, oauthConfig) || credentials.query[oauthConfig.urlKey];

  // validate JWT token if provided
  const checkAuth = jwt ? verifyToken.call(this.service, jwt) : Promise.resolve(false);

  // check if the profile is already attached to any existing credentials
  const getUsername = getInternalData.call(this.service, credentials.uid)
    .get(USERS_USERNAME_FIELD)
    .catchReturn({ statusCode: 404 }, false);

  return Promise.join(checkAuth, getUsername, (user, username) => {
    // user is authenticated and profile is attached
    if (user && username) {
      throw new Errors.HttpStatusError(412, 'profile is linked');
    }

    // found a linked user, log in
    if (username) {
      return Promise.bind(this.service, username)
        .then(loginAttempt)
        .tap(partial(refresh, credentials));
    }

    return { user, jwt, account: credentials };
  });
}

/**
 * General oauth strategies handler for any of the available providers
 * @param  {MserviceRequest} request
 * @returns {Promise}
 */
module.exports = function authHandler(request) {
  const { http } = this;
  const { action, transportRequest } = request;
  const { strategy } = action;

  /**
   * Build authentication context
   * @type {Object}
   */
  const ctx = {
    strategy,
    transportRequest,
    service: this,
  };

  return Promise
    .fromCallback((next) => {
      http.auth.test(strategy, transportRequest, (response, credentials) => next(null, [response, credentials]));
    })
    .bind(ctx)
    .spread(oauthVerification)
    .then(mserviceVerification);
};
