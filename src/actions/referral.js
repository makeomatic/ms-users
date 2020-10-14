const { ActionTransport } = require('@microfleet/core');
const redisKey = require('../utils/key');
const handlePipeline = require('../utils/pipeline-error');
const { USERS_REF, USERS_REF_METADATA } = require('../constants');

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
module.exports = async function storeReferral({ params }) {
  // basic context
  const { id, referral, metadata } = params;
  const key = redisKey(USERS_REF, id);
  const { expiration } = this.config.referral;

  const pipeline = this.redis.pipeline();

  if (metadata) {
    const metadataKey = redisKey(USERS_REF_METADATA, id);
    pipeline.hmset(metadataKey, metadata);
    pipeline.expire(metadataKey, expiration);
  }

  // set key -> referral
  // returns OK if op was performed, null otherwise
  pipeline.set(key, referral, 'EX', expiration, 'NX');

  return handlePipeline(await pipeline.exec());
};

module.exports.transports = [ActionTransport.amqp, ActionTransport.internal];
