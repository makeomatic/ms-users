const Promise = require('bluebird');
const { ActionTransport } = require('@microfleet/core');
const { getUserId } = require('../utils/userData');

const isMFARegExp = /mfa[./]/;
const isMfaRoute = route => isMFARegExp.test(route);
module.exports = [{
  point: 'postValidate',
  handler: async function postValidateHandler(error, request) {
    const result = [error, request];

    if (error) {
      return result;
    }

    // TODO: refactor after implementation of route specific hooks in core
    if (isMfaRoute(request.route) === false) {
      return result;
    }

    if (!request.locals) {
      request.locals = Object.create(null);
    }

    if (request.transport === ActionTransport.http) {
      request.locals.username = request.auth.credentials.id;
    } else if (request.params.username) {
      request.locals.username = await Promise
        .bind(this, request.params.username)
        .then(getUserId);
    }

    return result;
  },
}];
