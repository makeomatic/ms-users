const Promise = require('bluebird');
const generateEmail = require('../challenges/email/generate.js');
const {
  INVITATIONS_INDEX,
  TOKEN_METADATA_FIELD_CONTEXT,
  TOKEN_METADATA_FIELD_SENDED_AT,
} = require('../../constants.js');

module.exports = function sendInviteMail(params) {
  const { redis, tokenManager } = this;
  const { email, action, ctx = {} } = params;
  const now = Date.now();

  return tokenManager
    .create({
      id: email,
      action,
      regenerate: true,
      metadata: {
        [TOKEN_METADATA_FIELD_CONTEXT]: ctx,
        [TOKEN_METADATA_FIELD_SENDED_AT]: now,
      },
    })
    .then(token => Promise
      .bind(this, [email, action, { ...ctx, token }, { send: true }])
      .spread(generateEmail)
      .tap(() => redis.sadd(INVITATIONS_INDEX, email)));
};
