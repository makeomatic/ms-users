const { ActionTransport } = require('@microfleet/core');
const { HttpStatusError } = require('common-errors');

const RelayDisabledError = new HttpStatusError(412, 'tbits relay auth disabled');

/**
 * @api {amqp} <prefix>.relay.tbits Relay Tbits Authentication
 * @apiVersion 1.0.0
 * @apiName RelayTbitsAuth
 * @apiGroup Relay
 *
 * @apiDescription Verifies Tbits Session Id, creates "shadow" microfleet user if not exist, login and issues JWT token if everything is in order
 *
 * @apiParam (Payload) {String} sessionUid - tbits session uid to verify
 * @apiParam (Payload) {String} apiKey - tbits public api key
 */
async function tbitsAuth({ params, log }) {
  if (!this.config.tbits.enabled) {
    throw RelayDisabledError;
  }
  const { sessionUid, apiKey } = params;

  const response = await this.tbits.authenticate(sessionUid, apiKey);
  log.debug({ response }, 'verified session & signed in');
  return response;
}

tbitsAuth.schema = 'relay.tbits';
tbitsAuth.transports = [ActionTransport.amqp, ActionTransport.internal, ActionTransport.http];
tbitsAuth.transportOptions = {
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

module.exports = tbitsAuth;
