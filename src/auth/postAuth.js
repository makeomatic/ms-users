const Promise = require('bluebird');
const { ActionTransport } = require('@microfleet/core');

const isTfaRoute = route => /2fa/.test(route);

module.exports = [{
  point: 'postAuth',
  handler: function postAuthHandler(error, request) {
    const params = request.params ? request.params : request.query;

    // in case of http transport inject username inside params
    if (isTfaRoute(request.route) || request.transport === ActionTransport.http) {
      params.username = request.auth.credentials.id;
    }

    return Promise.resolve([error, request]);
  },
}];
