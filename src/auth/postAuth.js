const { ActionTransport } = require('@microfleet/core');

const isTfaRoute = route => /2fa/.test(route);

module.exports = [{
  point: 'postAuth',
  handler: function postAuthHandler(error, request) {
    const result = [error, request];

    if (error) {
      return result;
    }

    const params = request.params ? request.params : request.query;

    // in case of http transport inject username inside params
    if (isTfaRoute(request.route) && request.transport === ActionTransport.http) {
      params.username = request.auth.credentials.id;
    }

    return result;
  },
}];
