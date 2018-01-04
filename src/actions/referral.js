const redisKey = require('../utils/key');
const { USERS_REF } = require('../constants');

/**
 * @api {amqp} <prefix>.referral Store referral
 * @apiVersion 1.0.0
 * @apiName Referral
 * @apiGroup Users
 *
 * @apiDescription Stores referral for a specific identifier for use in the future with registration
 *
 * @apiParam (Payload) {String} id - hash of the browser, for instance
 * @apiParam (Payload) {String} referral - who claims the referral after registration
 *
 */
module.exports = function storeReferral({ params }) {
  // basic context
  const { id, referral } = params;
  const key = redisKey(USERS_REF, id);
  const { expiration } = this.config.referral;

  // set key -> referral
  // returns OK if op was performed, null otherwise
  return this.redis.set(key, referral, 'EX', expiration, 'NX');
};

module.exports.transports = [require('@microfleet/core').ActionTransport.amqp];
