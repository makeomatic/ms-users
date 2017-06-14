const Promise = require('bluebird');
const ActionTransport = require('@microfleet/core').ActionTransport;
const url = require('url');
const is = require('is');
const serialize = require('serialize-javascript');
const { AuthenticationRequiredError } = require('common-errors');

const isOauthAttachRoute = route => /oauth\.facebook$/.test(route);

module.exports = [{
  point: 'preResponse',
  handler: function preResponseHandler(error, result, request) {
    // return whatever we had before, no concern over it
    if (isOauthAttachRoute(request.route) === false || request.transport !== ActionTransport.http) {
      // pass-through
      return [error, result, request];
    }

    // will be copied over from mail server configuration
    const { config: { server } } = this;

    const targetOrigin = url.format({
      port: server.port,
      host: server.host,
      protocol: server.proto,
    });

    const message = error ? {
      payload: is.fn(error.toJSON) ? error.toJSON() : error.toString(),
      error: true,
      type: 'ms-users:attached',
      title: 'Failed to attach account',
    } : result;

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

      response = response.call('code', statusCode);
    }

    return Promise.all([null, response, request]);
  },
}];
