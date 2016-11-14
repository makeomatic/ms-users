const Promise = require('bluebird');
const generateEmail = require('../utils/challenges/email/generate.js');
const {
  INVITATIONS_INDEX,
  TOKEN_METADATA_FIELD_METADATA,
  TOKEN_METADATA_FIELD_CONTEXT,
  TOKEN_METADATA_FIELD_SENDED_AT,
  USERS_ACTION_INVITE,
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
 * @apiParam (Payload) {Object} [ctx] - context to be passed into email
 * @apiParam (Payload) {Number} [throttle] - if set, rejects to send another invite to the same email during that time
 * @apiParam (Payload) {Number} [ttl] - if set, invitation will expire in that time
 * @apiParam (Payload) {Object} [nodemailer] - if set, would be passed to nodemailer options
 * @apiParam (Payload) {Object} [metadata] - metadata to be added to the user upon registration
 * @apiParam (Payload) {Object} [metadata.*] - `*` is a namespace for which metadata would be added
 * @apiParam (Payload) {Mixed}  [metadata.*.*] - `*` is a key, for which associated value must be passed. It can be anything that
 * could be serialized using JSON.stringify()
 *
 */
module.exports = function generateInvite(request) {
  const { redis, tokenManager } = this;
  const { email, ctx = {}, throttle = 0, ttl = 0, metadata = {}, nodemailer = {} } = request.params;
  const now = Date.now();

  // do not throttle
  return tokenManager.create({
    id: email,
    action: USERS_ACTION_INVITE,
    regenerate: true,
    ttl, // defaults to never expiring
    throttle, // defaults to no throttle
    metadata: {
      [TOKEN_METADATA_FIELD_METADATA]: metadata,
      [TOKEN_METADATA_FIELD_CONTEXT]: ctx,
      [TOKEN_METADATA_FIELD_SENDED_AT]: now,
    },
  })
  .then(token => Promise
    .bind(this, [email, USERS_ACTION_INVITE, { ...ctx, token }, { send: true }, nodemailer])
    .spread(generateEmail)
    .tap(() => redis.sadd(INVITATIONS_INDEX, email)),
  );
};
