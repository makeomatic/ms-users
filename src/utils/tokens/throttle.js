// helpers
const isThrottled = require('../isThrottled.js')(false);
const key = require('../key.js');
const { SECRETS_NAMESPACE } = require('../../constants.js');

/**
 * Accepts secret type and pre-generated secret (defaults to uuid.v4), encrypts & stores it
 * into the database
 * @param  {String} namespace
 * @param  {String} type
 * @param  {String} [secret=uuid.v4()]
 * @return {Promise} contains { id, secret }
 */
module.exports = function applyThrottle(namespace, id, secret) {
  const { redis, config } = this;
  const { validation: { ttl, throttle } } = config;
  const secretKey = key(SECRETS_NAMESPACE, namespace, secret);

  const throttleArgs = [id, 1, 'NX'];
  if (throttle > 0) {
    throttleArgs.push('EX', throttle);
  }

  const args = [secretKey, namespace];
  if (ttl > 0) {
    args.push('EX', ttl);
  }

  return redis
    .set(throttleArgs)
    .then(isThrottled)
    .then(() => redis.set(args));
};
