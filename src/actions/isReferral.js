const Promise = require('bluebird');
const { ActionTransport } = require('@microfleet/plugin-router');

const { getUserId } = require('../utils/userData');
const { USERS_REFERRAL_INDEX } = require('../constants');

/**
 * Verifies
 * @return {Boolean} [description]
 */
function checkIndex(userId) {
  return this.redis
    .sismember(`${USERS_REFERRAL_INDEX}:${this.referralCode}`, userId)
    .then((yes) => (yes === 1 ? userId : false));
}

/**
 * @api {amqp} <prefix>.isReferral Checks if username is a referral
 * @apiVersion 1.0.0
 * @apiName verifyReferral
 * @apiGroup Users
 *
 * @apiDescription Verifies if <username> is a referral of <referralCode>. If username is a referral - returns true id,
 *   otherwise false
 *
 * @apiParam (Payload) {String} username
 * @apiParam (Payload) {String} referralCode
 */
module.exports = function isReferral({ params }) {
  const { username, referralCode } = params;
  const { redis } = this;

  return Promise
    .bind(this, username)
    .then(getUserId)
    .bind({
      referralCode,
      redis,
    })
    .then(checkIndex)
    .catchReturn(false);
};

module.exports.transports = [ActionTransport.amqp];
