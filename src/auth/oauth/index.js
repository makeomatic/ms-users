const Promise = require('bluebird');
const Errors = require('common-errors');
const partial = require('lodash/partial');

const get = require('../../utils/get-value');
const getUid = require('./utils/uid');
const refresh = require('./utils/refresh');
const extractJWT = require('./utils/extractJWT');
const { getInternalData } = require('../../utils/userData');

const { verifyToken, loginAttempt } = require('../../utils/amqp');
const { Redirect } = require('./utils/errors');
const { USERS_ID_FIELD } = require('../../constants');

// helpers
const isRedirect = ({ statusCode }) => statusCode === 301 || statusCode === 302;
const isError = ({ statusCode }) => statusCode >= 400;
const is404 = ({ statusCode }) => statusCode === 404;
const isHTMLRedirect = ({ statusCode, source }) => statusCode === 200 && source;

/**
 * Authentication handler
 * @param  {HttpClientResponse} response
 * @param  {Object} credentials
 * @returns {Array<HttpClientResponse, Credentials>}
 */
function oauthVerification(response, credentials) {
  this.service.log.debug({
    statusCode: response && response.statusCode,
    credentials,
  }, 'service oauth verification');

  if (response) {
    if (isError(response) || isHTMLRedirect(response)) {
      return Promise.reject(response);
    }

    if (isRedirect(response)) {
      // set redirect uri to rewrite the response in the hapi's preResponse hook
      const redirectUri = get(response, 'headers.location');
      return Promise.reject(new Redirect(redirectUri));
    }
  }

  if (!credentials) {
    return Promise.reject(new Errors.AuthenticationRequiredError('missed credentials'));
  }

  const { missingPermissions } = credentials;
  // verify missing permissions
  if (missingPermissions) {
    const { retryOnMissingPermissions, location } = this.config;

    if (retryOnMissingPermissions === true) {
      return Promise.reject(new Redirect(`${location}${this.transportRequest.path}?auth_type=rerequest&scope=${missingPermissions.join(',')}`));
    }

    if (retryOnMissingPermissions !== false) {
      const error = new Errors.AuthenticationRequiredError(`missing permissions - ${missingPermissions.join(',')}`);
      error.missingPermissions = missingPermissions;
      return Promise.reject(error);
    }
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
  // query on initial request is recorded and is available via credentials.query
  // https://github.com/hapijs/bell/blob/63603c9e897f3607efeeca87b6ef3c02b939884b/lib/oauth.js#L261
  const oauthConfig = this.service.config.oauth;
  const jwt = extractJWT(this.transportRequest, oauthConfig) || credentials.query[oauthConfig.urlKey];

  // validate JWT token if provided
  const checkAuth = jwt ? verifyToken.call(this.service, jwt) : Promise.resolve(false);

  // check if the profile is already attached to any existing credentials
  const getUserId = getInternalData
    .call(this.service, credentials.uid)
    .get(USERS_ID_FIELD)
    .catchReturn(is404, false);

  return Promise.join(checkAuth, getUserId, (user, userId) => {
    // user is authenticated and profile is attached
    if (user && userId) {
      throw new Errors.HttpStatusError(412, 'profile is linked');
    }

    // found a linked user, log in
    if (userId) {
      return Promise.bind(this.service, userId)
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
    const credentials = await http.auth.test(strategy, transportRequest);
    response = [null, credentials];
  } catch (err) {
    response = [err];
  }

  return Promise
    .bind(ctx, response)
    .spread(oauthVerification)
    .then(mserviceVerification);
};
