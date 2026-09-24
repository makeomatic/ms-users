const { HttpStatusError } = require('common-errors');
const { SignJWT, decodeJwt } = require('jose');
const { ActionTransport } = require('@microfleet/plugin-router');

const getMetadata = require('../utils/get-metadata');
const { getUserInfo } = require('../utils/userData');

/**
 * @api {amqp} <prefix>.intercom Intercom Messenger JWT
 * @apiVersion 1.0.0
 * @apiName Intercom
 * @apiGroup Users
 *
 * @apiDescription Issues HS256 JWT signed with Intercom Messenger API secret for the passed user.
 * Must only be reachable over internal transports, `username` is trusted as is
 *
 * @apiParam (Payload) {String} username - authenticated user's username
 * @apiParam (Payload) {String} [audience] - metadata audience, defaults to `jwt.defaultAudience`
 *
 * @apiSuccess (Response) {String} token - signed Intercom Messenger JWT
 * @apiSuccess (Response) {Number} expiresAt - token expiration time in ms
 */
async function intercomToken({ params }) {
  const { enabled, secret, ttl, attributes } = this.config.intercom;

  if (!enabled || !secret) {
    throw new HttpStatusError(501, 'intercom is not enabled');
  }

  const { username, audience = this.config.jwt.defaultAudience } = params;
  const { userId } = await getUserInfo.call(this, username, true);
  const { [audience]: metadata } = await getMetadata(this, userId, [audience]);

  // identity claims go last so configured attributes can't override them
  const token = await new SignJWT({
    ...attributes,
    ...(metadata.name ? { name: metadata.name } : {}),
    user_id: userId,
    email: metadata.username,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(Buffer.from(secret));

  const { exp } = decodeJwt(token);

  return { token, expiresAt: exp * 1000 };
}

intercomToken.transports = [ActionTransport.amqp, ActionTransport.internal];

module.exports = intercomToken;
