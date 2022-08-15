const { ActionTransport } = require('@microfleet/plugin-router');

const { selectChallenge } = require('../utils/challenges/challenge');
const { TOKEN_METADATA_FIELD_CONTEXT } = require('../constants');

/**
 * @api {amqp} <prefix>.regenerate-token Regenerate expired token
 * @apiVersion 1.0.0
 * @apiName RegenerateToken
 * @apiGroup Users
 *
 * @apiDescription This method allowes to regenerate expired token. It takes `uid`
 * or `id` and `action` as token identificator. Currently only phone challenge supported.
 *
 * @apiSchema {jsonschema=../../schemas/regenerate-token.json} apiParam
 */
module.exports = async function regenerateToken({ params }) {
  const { action, challengeType, id, uid } = params;
  const { tokenManager } = this;
  const args = uid ? { uid } : { action, id };

  await tokenManager.regenerate(args);
  const token = await tokenManager.info(args);

  let context;
  if (token.metadata && token.metadata[TOKEN_METADATA_FIELD_CONTEXT]) {
    context = token.metadata[TOKEN_METADATA_FIELD_CONTEXT];
  } else {
    context = Object.create(null);
  }

  const challenge = selectChallenge(challengeType, token.action, { ...context, token });
  const challengeResponse = await challenge.call(this, token.id);
  const response = { regenerated: true };
  const tokenUid = challengeResponse.context.token.uid;

  if (uid) {
    response.uid = tokenUid;
  }

  return response;
};

module.exports.validateResponse = false;
module.exports.transports = [ActionTransport.amqp, ActionTransport.internal];
