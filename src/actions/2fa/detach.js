const { ActionTransport } = require('@microfleet/core');
const Promise = require('bluebird');
const redisKey = require('../../utils/key');
const handlePipeline = require('../../utils/pipelineError');
const { check2FA } = require('../../utils/2fa.js');
const {
  USERS_METADATA,
  USERS_2FA_FLAG,
  USERS_2FA_SECRET,
  USERS_2FA_RECOVERY,
  TFA_TYPE_REQUIRED,
} = require('../../constants');

function removeData() {
  const { username, redis, config } = this;
  const { jwt: { defaultAudience } } = config;

  return redis
    .pipeline()
    .del(redisKey(USERS_2FA_SECRET, username), redisKey(USERS_2FA_RECOVERY, username))
    .hdel(redisKey(username, USERS_METADATA, defaultAudience), USERS_2FA_FLAG)
    .then(handlePipeline)
    .exec()
    .return({ enabled: false });
}

/**
 * @api {amqp} <prefix>.detach Detach
 * @apiVersion 1.0.0
 * @apiName Detach
 * @apiGroup Users
 *
 * @apiDescription Allows to detach secret key and recovery code from user's account,
 * basically disables 2FA.
 *
 * @apiHeader (Authorization) {String} Authorization JWT :accessToken
 * @apiHeaderExample Authorization-Example:
 *     "Authorization: JWT my.reallyniceandvalid.jsonwebtoken"
 * @apiHeader (Authorization) {String} X-Auth-TOTP TOTP or recoveryCode
 * @apiHeaderExample X-Auth-TOTP-Example:
 *     "X-Auth-TOTP: 123456"
 *
 * @apiParam (Payload) {String} username - id of the user
 * @apiParam (Payload) {Number} totp - 6 chars time-based one time password or
 * 8 characters hex recovery code
 * @apiParam (Payload) {String} [remoteip] - security logging feature, not used
 *
 */
module.exports = function detach({ params }) {
  const { username } = params;
  const { redis, config } = this;
  const ctx = { redis, config, username };

  return Promise
    .bind(ctx)
    .then(removeData);
};

module.exports.tfa = TFA_TYPE_REQUIRED;
module.exports.allowed = check2FA;
module.exports.auth = 'httpBearer';
module.exports.transports = [ActionTransport.http, ActionTransport.amqp];
