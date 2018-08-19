const { ActionTransport } = require('@microfleet/core');
const bearer = require('./strategy.bearer');

function tokenAuth(request) {
  switch (request.transport) {
    case ActionTransport.http:
      return bearer.call(this, request);

    default:
      return null;
  }
}

module.exports = tokenAuth;
