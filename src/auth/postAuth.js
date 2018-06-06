const { ActionTransport } = require('@microfleet/core');

const isTfaRoute = route => /2fa/.test(route);
module.exports = [{
  point: 'postAuth',
  handler: function postAuthHandler(error, request) {
    const result = [error, request];

    if (error) {
      return result;
    }

    // in case of http transport inject username inside params
    if (request.transport === ActionTransport.http && isTfaRoute(request.route)) {
      const property = request.method === 'get' ? 'query' : 'params';
      request[property].username = request.auth.credentials.id;
    }

    return result;
  },
}];
