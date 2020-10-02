const generateEmail = require('../challenges/email/generate.js');
const {
  organizationInvite,
  inviteId,
  TOKEN_METADATA_FIELD_CONTEXT,
  TOKEN_METADATA_FIELD_SENDED_AT,
  USERS_ACTION_ORGANIZATION_INVITE,
  TOKEN_METADATA_FIELD_METADATA,
} = require('../../constants.js');

module.exports = async function sendInviteMail(params) {
  const { redis, tokenManager } = this;
  const { email, ctx } = params;
  const now = Date.now();
  this.service.log.debug(params, 'send invite mail');

  const token = await tokenManager
    .create({
      id: inviteId(ctx.organizationId, email),
      action: USERS_ACTION_ORGANIZATION_INVITE,
      regenerate: true,
      metadata: {
        [TOKEN_METADATA_FIELD_METADATA]: { permissions: ctx.permissions },
        [TOKEN_METADATA_FIELD_CONTEXT]: ctx,
        [TOKEN_METADATA_FIELD_SENDED_AT]: now,
      },
    });

  await generateEmail.call(this, email, USERS_ACTION_ORGANIZATION_INVITE, { ...ctx, token }, { send: true });
  await redis.sadd(organizationInvite(ctx.organizationId), email);
};
