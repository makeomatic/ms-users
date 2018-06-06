const { ActionTransport } = require('@microfleet/core');
const bearer = require('./strategy.bearer');

function tokenAuth(request) {
  if (request.transport === ActionTransport.http) {
    return bearer.call(this, request);
  }

  return null;
}

module.exports = tokenAuth;
