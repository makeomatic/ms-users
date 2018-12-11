const Promise = require('bluebird');
const url = require('url');
const is = require('is');
const serializeError = require('serialize-error');
const serialize = require('serialize-javascript');
const { ActionTransport } = require('@microfleet/core');
const { AuthenticationRequiredError } = require('common-errors');
const { Redirect } = require('./utils/errors');
const { ErrorTotpRequired } = require('../../constants');
const { getSignedToken } = require('./utils/getSignedToken');

const isOauthAttachRoute = route => route.endsWith('oauth.facebook');

module.exports = [{
  point: 'preResponse',
  async handler(error, result, request) {
    // return whatever we had before, no concern over it
    if (isOauthAttachRoute(request.route) === false || request.transport !== ActionTransport.http) {
      // pass-through
      return [error, result, request];
    }

    if (error && error.constructor === Redirect) {
      return Promise.reject(error);
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
        payload: await getSignedToken(request.auth.credentials),
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

    // erase stack, no need to push it out
    if (error && message.payload.stack) {
      message.payload.stack = undefined;
    }

    let response = request.transportRequest.sendView('providerAttached', {
      targetOrigin,
      message: serialize(message),
    });

    if (error) {
      // NOTE: ensure that 401 errors will be kept
      let statusCode;
      switch (error.constructor) {
        case AuthenticationRequiredError:
          statusCode = 401;
          break;

        default:
          statusCode = error.statusCode || 500;
      }

      const reply = await response;
      response = reply.code(statusCode);
    }

    return Promise.all([null, response, request]);
  },
}];
