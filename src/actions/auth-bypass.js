const { ActionTransport } = require('@microfleet/core');
const { HttpStatusError } = require('common-errors');

/**
 * @api {amqp} <prefix>.auth-bypass Relay Tbits Authentication
 * @apiVersion 1.0.0
 *
 * @apiDescription Verifies 3rd party auth, creates "shadow" microfleet user if not exist, login and issues JWT token if everything is in order
 *
 * @apiParam (Payload) {String} schema - bypass auth schema
 * @apiParam (Payload) {String} userKey - user id, token or orther identificator required 3rd party auth api
 */
async function authBypass({ params, log }) {
  const { schema, userKey } = params;

  const api = this.bypass[schema];

  if (!api) {
    throw new HttpStatusError(412, `${schema} auth disabled`);
  }

  const response = await api.authenticate(userKey);
  log.debug({ response }, 'verified session & signed in');
  return response;
}

authBypass.schema = 'auth-bypass';
authBypass.transports = [ActionTransport.amqp, ActionTransport.internal, ActionTransport.http];
authBypass.transportOptions = {
  [ActionTransport.http]: {
    methods: ['post'],
  },
  [ActionTransport.amqp]: {
    methods: [ActionTransport.amqp],
  },
  [ActionTransport.internal]: {
    methods: [ActionTransport.internal],
  },
};

module.exports = authBypass;
