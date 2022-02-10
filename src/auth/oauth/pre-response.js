const { serializeError } = require('serialize-error');
const serialize = require('serialize-javascript');
const { AuthenticationRequiredError } = require('common-errors');
const { ActionTransport } = require('@microfleet/plugin-router');

const { Redirect } = require('./utils/errors');
const { ErrorTotpRequired } = require('../../constants');
const { getSignedToken } = require('./utils/get-signed-token');

const isOauthAttachRoute = (route) => route.endsWith('oauth.facebook')
  || route.endsWith('oauth.apple')
  || route.endsWith('oauth.upgrade');

/**
 * @typedef { import('@microfleet/plugin-router').LifecycleExtension } LifecycleExtension
 * @type {LifecycleExtension[]}
 */
module.exports = [{
  point: 'preResponse',
  async handler(request) {
    // return whatever we had before, no concern over it
    if (isOauthAttachRoute(request.route) === false || request.transport !== ActionTransport.http) {
      // pass-through
      return request;
    }

    const { error } = request;
    if (error && error.constructor === Redirect) {
      throw error;
    }

    if (error && error.statusCode === 200 && error.source) {
      request.response = error.source;
      request.error = null;
      return request;
    }

    // will be copied over from mail server configuration
    const { config: { server, oauth: { debug } } } = this;

    const targetOrigin = debug ? '*' : `${server.proto}/${server.host}:${server.port}`;

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
        payload: typeof error.toJSON === 'function'
          ? error.toJSON()
          : serializeError(error),
        error: true,
        type: 'ms-users:attached',
        title: 'Failed to attach account',
        meta: {},
      };
    } else {
      message = request.response;
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
      request.response = await request.transportRequest
        .generateResponse(message)
        .code(statusCode);

      return request;
    }

    request.response = await request.transportRequest.sendView('providerAttached', {
      targetOrigin,
      message: serialize(message, {
        ignoreFunction: true,
      }),
    });

    if (error) {
      request.response = request.response.code(statusCode);
    }

    request.error = null;
    return request;
  },
}];
