const stringify = JSON.stringify.bind(JSON);
const uuid = require('node-uuid');
const mapValues = require('lodash/mapValues');
const challenge = require('../utils/send-challenge.js');
const handlePipeline = require('../utils/pipelineError.js');
const redisKey = require('../utils/key.js');
const {
  INVITATIONS_KEY,
  INVITATIONS_INDEX,
  INVITATIONS_FIELD_METADATA,
  INVITATIONS_FIELD_EMAIL,
  INVITATIONS_FIELD_EXPIRE,
  INVITATIONS_FIELD_SENT,
  INVITATIONS_FIELD_DATE,
  INVITATIONS_FIELD_GREETING,
  MAIL_INVITE,
} = require('../constants.js');

/**
 * @api {amqp} <prefix>.invite Generate User Invitation
 * @apiVersion 1.0.0
 * @apiName inviteuser
 * @apiGroup Users
 *
 * @apiDescription Send an email with special registration link, which embeds a token. When supplied during registration
 * process it will allow user to not verify him or herself, as well as add extra metadata to their profile when registration
 * is complete. Can only be used once and could have an expiration date.
 *
 * @apiParam (Payload) {String} email - used to send the invitation
 * @apiParam (Payload) {String} greeting - greeting to be used in the email
 * @apiParam (Payload) {Number} [expire] - if set, token will expire in `expire` seconds
 * @apiParam (Payload) {Object} [metadata] - metadata to be added to the user upon registration
 * @apiParam (Payload) {Object} [metadata.*] - `*` is a namespace for which metadata would be added
 * @apiParam (Payload) {Mixed}  [metadata.*.*] - `*` is a key, for which associated value must be passed. It can be anything that
 * could be serialized using JSON.stringify()
 *
 */
module.exports = function generateInvite({ email, greeting, expire = 0, metadata = {} }) {
  const { redis } = this;

  // invitation token
  const token = uuid.v4();
  const now = Date.now();
  const key = redisKey(INVITATIONS_KEY, token);
  const data = mapValues({
    [INVITATIONS_FIELD_METADATA]: metadata,
    [INVITATIONS_FIELD_EMAIL]: email,
    [INVITATIONS_FIELD_DATE]: now,
    [INVITATIONS_FIELD_EXPIRE]: expire ? now + expire * 1000 : 0,
    [INVITATIONS_FIELD_SENT]: false,
    [INVITATIONS_FIELD_GREETING]: greeting,
  }, stringify);

  return redis
    .pipeline()
    .sadd(INVITATIONS_INDEX, token)
    .hmset(key, data)
    .exec()
    .then(handlePipeline)
    .bind(this)
    .return({
      id: email,
      type: MAIL_INVITE,
      wait: false,
      secret: token,
      ctx: {
        greeting,
      },
    })
    .then(challenge);
};
