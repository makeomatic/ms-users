const { HttpStatusError } = require('common-errors');
const { SignJWT } = require('jose');
const { ActionTransport } = require('@microfleet/plugin-router');

const getMetadata = require('../utils/get-metadata');
const { getUserInfo } = require('../utils/userData');

const MIN_SECRET_LENGTH = 32;
const isEmail = (value) => /^[^@\s]+@[^@\s]+$/.test(value);

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
 *
 * @apiSuccess (Response) {String} token - signed Intercom Messenger JWT
 * @apiSuccess (Response) {Number} expiresAt - token expiration time in ms
 */
async function intercomToken({ params }) {
  const { enabled, secret, ttl, attributes } = this.config.intercom;

  if (!enabled || !secret || Buffer.byteLength(secret) < MIN_SECRET_LENGTH) {
    throw new HttpStatusError(501, 'intercom is not enabled');
  }

  const { username } = params;
  const { defaultAudience } = this.config.jwt;
  const { userId } = await getUserInfo.call(this, username, true);
  const { [defaultAudience]: metadata } = await getMetadata(this, userId, [defaultAudience]);
  const { name, username: email } = metadata;

  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + ttl;

  // identity claims go last so configured attributes can't override them,
  // undefined values are dropped on serialization
  const token = await new SignJWT({
    ...attributes,
    name: typeof name === 'string' && name ? name : undefined,
    user_id: userId,
    email: isEmail(email) ? email : undefined,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(Buffer.from(secret));

  return { token, expiresAt: exp * 1000 };
}

intercomToken.transports = [ActionTransport.amqp, ActionTransport.internal];

module.exports = intercomToken;
