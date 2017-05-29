const Promise = require('bluebird');
const ActionTransport = require('mservice').ActionTransport;
const url = require('url');
const serialize = require('serialize-javascript');

const isOauthAttachRoute = route => /oauth\.facebook$/.test(route);

module.exports = [{
  point: 'postHandler',
  handler: function postHandler(error, result, request) {
    // return whatever we had before, no concern over it
    if (isOauthAttachRoute(request.route) === false || request.transport !== ActionTransport.http) {
      // pass-through
      return [error, result];
    }

    // will be copied over from mail server configuration
    const { config: { server } } = this;

    const targetOrigin = url.format({
      port: server.port,
      host: server.host,
      protocol: server.proto,
    });

    const message = error ? {
      payload: error,
      error: true,
      type: 'ms-users:attached',
      title: 'Failed to attach account',
    } : result;

    let response = request.transportRequest.sendView('providerAttached', {
      targetOrigin,
      message: serialize(message),
    });

    if (error) {
      response = response.call('code', error.statusCode || 500);
    }

    return Promise.all([null, response]);
  },
}];
