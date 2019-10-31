const Promise = require('bluebird');
const Errors = require('common-errors');
const Boom = require('@hapi/boom');

const get = require('../../utils/get-value');
const getUid = require('./utils/uid');
const refresh = require('./utils/refresh');
const extractJWT = require('./utils/extract-jwt');
const { getInternalData } = require('../../utils/userData');

const { verifyToken, loginAttempt } = require('../../utils/amqp');
const { Redirect, OAuthError } = require('./utils/errors');
const { USERS_ID_FIELD, ErrorTotpRequired } = require('../../constants');

// helpers
const isRedirect = ({ statusCode }) => statusCode === 301 || statusCode === 302;
const is404 = ({ statusCode }) => statusCode === 404;
const isError = ({ statusCode }) => statusCode >= 400;
const isHTMLRedirect = ({ statusCode, source }) => statusCode === 200 && source;

/**
 * Authentication handler
 *
 * @param {Object} ctx
 * @param {HttpClientResponse} [response]
 * @param {Object} credentials
 * @returns {Array<HttpClientResponse, Credentials>}
 */
async function oauthVerification({ service, transportRequest, config, strategy }, response, credentials) {
  service.log.debug({
    statusCode: response && response.statusCode,
    headers: response && response.headers,
    credentials,
  }, 'service oauth verification');

  if (response) {
    if (isError(response) || isHTMLRedirect(response)) {
      throw response;
    }

    if (isRedirect(response)) {
      // set redirect uri to rewrite the response in the hapi's preResponse hook
      const redirectUri = get(response, 'headers.location');
      throw new Redirect(redirectUri);
    }
  }

  if (!credentials) {
    throw new Errors.AuthenticationRequiredError('missed credentials');
  }

  const { missingPermissions } = credentials;
  // verify missing permissions
  if (missingPermissions) {
    const { retryOnMissingPermissions, location } = config;

    if (retryOnMissingPermissions === true) {
      service.log.warn({ location, path: transportRequest.path }, 'sending to fb for additional data');
      throw new Redirect(`${location}${transportRequest.path}?auth_type=rerequest&scope=${missingPermissions.join(',')}`);
    }

    if (retryOnMissingPermissions !== false) {
      const error = new Errors.AuthenticationRequiredError(`missing permissions - ${missingPermissions.join(',')}`);
      error.missingPermissions = missingPermissions;
      throw error;
    }
  }

  // set actual strategy for confidence
  credentials.provider = strategy;

  // create uid and inject it inside account && internal data
  const uid = getUid(credentials);
  credentials.uid = uid;
  credentials.profile.uid = uid;
  credentials.internals.uid = uid;

  return credentials;
}

async function mserviceVerification({ service, transportRequest }, credentials) {
  // query on initial request is recorded and is available via credentials.query
  // https://github.com/hapijs/bell/blob/63603c9e897f3607efeeca87b6ef3c02b939884b/lib/oauth.js#L261
  const oauthConfig = service.config.oauth;
  const jwt = extractJWT(transportRequest, oauthConfig) || credentials.query[oauthConfig.urlKey];

  // validate JWT token if provided
  const checkAuth = jwt
    ? verifyToken.call(service, jwt)
    : false;

  // check if the profile is already attached to any existing credentials
  const getUserId = getInternalData
    .call(service, credentials.uid)
    .get(USERS_ID_FIELD)
    .catchReturn(is404, false);

  const [user, userId] = await Promise.all([checkAuth, getUserId]);

  // user is authenticated and profile is attached
  if (user && userId) {
    throw new Errors.HttpStatusError(412, 'profile is linked');
  }

  // found a linked user, log in
  if (userId) {
    // pass-on internal user-id
    credentials.profile.userId = userId;

    try {
      const userData = await loginAttempt.call(service, userId);
      refresh.call(service, credentials, userData);

      return userData;
    } catch (error) {
      if (error.code === ErrorTotpRequired.code) {
        error.credentials = credentials;
      }

      throw error;
    }
  }

  return { user, jwt, account: credentials };
}

/**
 * General oauth strategies handler for any of the available providers
 * @param  {MserviceRequest} request
 * @returns {Promise}
 */
module.exports = async function authHandler({ action, transportRequest }) {
  const { http, config } = this;
  const { strategy } = action;

  /**
   * Build authentication context
   * @type {Object}
   */
  const ctx = {
    strategy,
    transportRequest,
    service: this,
    config: config.oauth.providers[strategy],
  };

  let response;
  try {
    const { credentials } = await http.auth.test(strategy, transportRequest);
    response = [null, credentials];
  } catch (err) {
    if (Boom.isBoom(err)) {
      const { message } = err;

      // Error thrown when user declines OAuth
      if (message.startsWith('App rejected')) {
        throw Errors.AuthenticationRequiredError(`OAuth ${err.message}`, err);
      }

      throw OAuthError(err.message, err);
    }
    // continue if redirect
    response = [err];
  }

  const credentials = await oauthVerification(ctx, ...response);
  return mserviceVerification(ctx, credentials);
};
