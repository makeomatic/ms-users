const { ActionTransport } = require('@microfleet/plugin-router');

const bearer = require('./strategy.bearer');

function tokenAuth(request) {
  switch (request.transport) {
    case ActionTransport.http:
      return bearer.call(this, request);

    default:
      request.auth = { credentials: null };
      return null;
  }
}

module.exports = tokenAuth;
