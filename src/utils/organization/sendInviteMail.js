const Promise = require('bluebird');
const get = require('get-value');
const generateEmail = require('../challenges/email/generate.js');
const {
  INVITATIONS_INDEX,
  TOKEN_METADATA_FIELD_CONTEXT,
  TOKEN_METADATA_FIELD_SENDED_AT,
  USERS_ACTION_ORGANIZATION_INVITE,
} = require('../../constants.js');

module.exports = function sendInviteMail(params) {
  const { redis, tokenManager, config } = this;
  const { email, ctx = {} } = params;
  const now = Date.now();
  ctx.inviteLink = get(config, 'validation.links.acceptInvite');

  return tokenManager
    .create({
      id: email,
      action: USERS_ACTION_ORGANIZATION_INVITE,
      regenerate: true,
      metadata: {
        [TOKEN_METADATA_FIELD_CONTEXT]: ctx,
        [TOKEN_METADATA_FIELD_SENDED_AT]: now,
      },
    })
    .then(token => Promise
      .bind(this, [email, USERS_ACTION_ORGANIZATION_INVITE, { ...ctx, token }, { send: true }])
      .spread(generateEmail)
      .tap(() => redis.sadd(INVITATIONS_INDEX, email)));
};
