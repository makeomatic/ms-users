const Promise = require('bluebird');
const { ActionTransport } = require('@microfleet/core');
const { throwIfDisabled, check2FA } = require('../../utils/2fa.js');

/**
 * @api {amqp} <prefix>.verify Verify TOTP
 * @apiVersion 1.0.0
 * @apiName Verify
 * @apiGroup Users
 *
 * @apiDescription Allows to verify if TOTP provided by the user is valid.
 *
 * @apiHeader (Authorization) {String} Authorization JWT :accessToken
 * @apiHeaderExample Authorization-Example:
 *     "Authorization: JWT my.reallyniceandvalid.jsonwebtoken"
 *
 * @apiParam (Payload) {String} username - id of the user
 * @apiParam (Payload) {Number} totp - 6 chars time-based one time password or
 * 8 characters hex recovery code
 * @apiParam (Payload) {String} [remoteip] - security logging feature, not used
 *
 */
module.exports = function verify({ params }) {
  const { redis } = this;
  const { username } = params;
  const ctx = { redis, username };

  return Promise
    .bind(ctx)
    .then(throwIfDisabled)
    .then(() => ({ valid: true }));
};

module.exports.tfa = true;
module.exports.allowed = check2FA;
module.exports.transports = [ActionTransport.amqp];
