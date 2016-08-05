const generateEmail = require('../utils/challenges/generateEmail.js');
const {
  INVITATIONS_INDEX,
  INVITATIONS_FIELD_METADATA,
  INVITATIONS_FIELD_CTX,
  INVITATIONS_FIELD_SENT,
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
module.exports = function generateInvite(request) {
  const { redis, tokenManager } = this;
  const { email, ctx = {}, throttle = 0, ttl = 0, metadata = {} } = request.params;
  const now = Date.now();

  // do not throttle
  return tokenManager.create({
    id: email,
    action: MAIL_INVITE,
    regenerate: true,
    ttl, // defaults to never expiring
    throttle, // defaults to no throttle
    metadata: {
      [INVITATIONS_FIELD_METADATA]: metadata,
      [INVITATIONS_FIELD_CTX]: ctx,
      [INVITATIONS_FIELD_SENT]: now,
    },
  })
  .then(token => Promise
    .bind(this, [email, MAIL_INVITE, { token }, { send: true }])
    .spread(generateEmail)
    .tap(() => redis.sadd(INVITATIONS_INDEX, email))
  );
};
