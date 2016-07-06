// 3rd party
const uuid = require('node-uuid');

// helpers
const isThrottled = require('../isThrottled.js')(true);
const key = require('../key.js');
const { THROTTLE_NAMESPACE } = require('../../constants.js');

/**
 * Accepts secret type and pre-generated secret (defaults to uuid.v4), encrypts & stores it
 * into the database
 * @param  {String} namespace
 * @param  {String} type
 * @param  {String} [secret=uuid.v4()]
 * @return {Promise} contains { id, secret }
 */
module.exports = function createToken({ id, challengeType, expire, secret = uuid.v4() }) {
  const { redis } = this;
  const namespace = key(THROTTLE_NAMESPACE, challengeType, id);

  return redis
    .get(namespace)
    .then(isThrottled)
    .return({ namespace, expire, secret, id });
};
