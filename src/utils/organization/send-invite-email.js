const generateEmail = require('../challenges/email/generate');
const {
  organizationInvite,
  inviteId,
  TOKEN_METADATA_FIELD_CONTEXT,
  TOKEN_METADATA_FIELD_SENDED_AT,
  USERS_ACTION_ORGANIZATION_INVITE,
  TOKEN_METADATA_FIELD_METADATA,
} = require('../../constants');

module.exports = async function sendInviteMail(params, action = USERS_ACTION_ORGANIZATION_INVITE) {
  const { redis, tokenManager } = this;
  const { email, ctx } = params;
  const now = Date.now();

  const token = await tokenManager
    .create({
      action,
      id: inviteId(ctx.organizationId, email),
      regenerate: true,
      metadata: {
        [TOKEN_METADATA_FIELD_METADATA]: { permissions: ctx.permissions },
        [TOKEN_METADATA_FIELD_CONTEXT]: ctx,
        [TOKEN_METADATA_FIELD_SENDED_AT]: now,
      },
    });

  const res = await generateEmail.call(this, email, action, { ...ctx, token }, { wait: true, send: true });

  if (res.err) {
    this.log.error(res, 'send invite mail result');
  }

  if (action === USERS_ACTION_ORGANIZATION_INVITE) {
    await redis.sadd(organizationInvite(ctx.organizationId), email);
  }
};
