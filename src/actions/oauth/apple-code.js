const url = require('url');
const serialize = require('serialize-javascript');

const { ActionTransport } = require('@microfleet/plugin-router');

async function appleCodeCallbackAction(request) {
  // will be copied over from mail server configuration
  const { config: { server, oauth: { debug } } } = this;
  const targetOrigin = debug ? '*' : url.format({
    proto: server.proto,
    host: server.host,
    port: server.port,
  });
  const { code, user } = request.params;

  return request.transportRequest.sendView('apple-code', {
    targetOrigin,
    params: serialize({ code, user }),
  });
}

// @TODO check Bell state
// async function isAllowed(request) {

// }

// appleCodeCallbackAction.allowed = isAllowed;
appleCodeCallbackAction.transports = [ActionTransport.http];
appleCodeCallbackAction.transportOptions = {
  [ActionTransport.http]: {
    methods: ['post'],
  },
};

module.exports = appleCodeCallbackAction;
