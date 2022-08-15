const { HttpStatusError } = require('common-errors');
const { ActionTransport } = require('@microfleet/plugin-router');

/**
 * @api {amqp} <prefix>.auth-bypass Authentication through 3rd party api
 * @apiVersion 1.0.0
 *
 * @apiDescription Verifies 3rd party auth, creates "shadow" microfleet user if not exist, login and issues JWT token if everything is in order
 *
 * @apiParam (Payload) {String} schema - bypass auth schema
 * @apiParam (Payload) {String} userKey - user id, token or orther identificator required 3rd party auth api
 */
async function authBypass({ params, log }) {
  const { schema, userKey } = params;
  const [schemaName, account] = schema.split(':');
  const api = this.bypass[schemaName];

  if (!api) {
    throw new HttpStatusError(412, `${schemaName} auth disabled`);
  }

  const response = await api.authenticate(userKey, account);
  log.debug({ response }, 'verified session & signed in');
  return response;
}

authBypass.schema = 'auth-bypass';
authBypass.validateResponse = false;
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
