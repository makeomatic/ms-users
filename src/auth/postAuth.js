const { ActionTransport } = require('@microfleet/core');
const { getUserId } = require('../utils/userData');

const isTfaRoute = route => /2fa/.test(route);
module.exports = [{
  point: 'postAuth',
  handler: async function postAuthHandler(error, request) {
    const result = [error, request];

    if (error) {
      return result;
    }

    // TODO: refactor after implementation of route specific hooks in core
    if (isTfaRoute(request.route)) {
      request.locals = {};

      if (request.transport === ActionTransport.http) {
        request.locals.username = request.auth.credentials.id;
        return result;
      }

      const { username } = request.params;
      if (username) {
        request.locals.username = await getUserId.call(this, username);
      }
    }

    return result;
  },
}];
