const bearer = require('./strategy.bearer');

function tokenAuth(request) {
  if (request.method === 'http') return bearer.call(this, request);
  return null;
}

module.exports = tokenAuth;
