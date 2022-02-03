const Promise = require('bluebird');
const url = require('url');
const is = require('is');
const { serializeError } = require('serialize-error');
const serialize = require('serialize-javascript');
const { AuthenticationRequiredError } = require('common-errors');

const { ActionTransport } = require('../../re-export');

const { Redirect } = require('./utils/errors');
const { ErrorTotpRequired } = require('../../constants');
const { getSignedToken } = require('./utils/get-signed-token');

const isOauthAttachRoute = (route) => route.endsWith('oauth.facebook')
  || route.endsWith('oauth.apple')
  || route.endsWith('oauth.upgrade');

module.exports = [{
  point: 'preResponse',
  async handler(error, result, request) {
    // return whatever we had before, no concern over it
    if (isOauthAttachRoute(request.route) === false || request.transport !== ActionTransport.http) {
      // pass-through
      return [error, result, request];
    }

    if (error && error.constructor === Redirect) {
      throw error;
    }

    if (error && error.statusCode === 200 && error.source) {
      return [null, error.source, request];
    }

    // will be copied over from mail server configuration
    const { config: { server, oauth: { debug } } } = this;

    const targetOrigin = debug ? '*' : url.format({
      port: server.port,
      host: server.host,
      protocol: server.proto,
    });

    let message;
    if (error && error.code === ErrorTotpRequired.code) {
      message = {
        payload: {
          userId: error.credentials.profile.userId,
          ...await getSignedToken.call(this, error.credentials),
        },
        error: true,
        type: 'ms-users:totp_required',
        title: 'MFA required',
      };
    } else if (error) {
      message = {
        payload: is.fn(error.toJSON) ? error.toJSON() : serializeError(error),
        error: true,
        type: 'ms-users:attached',
        title: 'Failed to attach account',
        meta: {},
      };
    } else {
      message = result;
    }

    if (message.error === true) {
      this.log.warn({ error: message.payload }, 'oauth error');
    }

    let statusCode = 200;
    if (error) {
      // erase stack
      if (typeof message.payload.stack !== 'undefined') {
        delete message.payload.stack;
      }

      // erase inner_error if its undefined
      if (message.payload.inner_error == null) {
        delete message.payload.inner_error;
      }

      // NOTE: ensure that 401 errors will be kept
      switch (error.constructor) {
        case AuthenticationRequiredError:
          statusCode = 401;
          break;

        default:
          statusCode = error.statusCode || 500;
      }
    }

    if (!request.route.endsWith('oauth.facebook') && !request.route.endsWith('oauth.apple')) {
      const response = request.transportRequest
        .generateResponse(message)
        .code(statusCode);

      return Promise.all([null, response, request]);
    }

    let response = request.transportRequest.sendView('providerAttached', {
      targetOrigin,
      message: serialize(message, {
        ignoreFunction: true,
      }),
    });

    if (error) {
      const reply = await response;
      response = reply.code(statusCode);
    }

    return Promise.all([null, response, request]);
  },
}];
