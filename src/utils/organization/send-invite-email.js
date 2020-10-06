const generateEmail = require('../challenges/email/generate.js');
const {
  organizationInvite,
  inviteId,
  TOKEN_METADATA_FIELD_CONTEXT,
  TOKEN_METADATA_FIELD_SENDED_AT,
  USERS_ACTION_ORGANIZATION_INVITE,
  USERS_ACTION_ORGANIZATION_REGISTER,
  TOKEN_METADATA_FIELD_METADATA,
} = require('../../constants.js');

module.exports = async function sendInviteMail(params) {
  const { redis, tokenManager } = this;
  const { email, ctx } = params;
  const now = Date.now();

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

  const emailType = ctx.password ? USERS_ACTION_ORGANIZATION_REGISTER : USERS_ACTION_ORGANIZATION_INVITE;
  const res = await generateEmail.call(this, email, emailType, { ...ctx, token }, { wait: true, send: true });

  if (res.err) {
    this.log.error(res, 'send invite mail result');
  }

  await redis.sadd(organizationInvite(ctx.organizationId), email);
};
