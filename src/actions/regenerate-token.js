const Promise = require('bluebird');
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
function regenerateToken(request) {
  const { action, challengeType, id, uid } = request.params;
  const { tokenManager } = this;
  const args = uid ? { uid } : { action, id };

  return Promise
    .bind(tokenManager, args)
    .tap(tokenManager.regenerate)
    .then(tokenManager.info)
    .bind(this)
    .then((token) => {
      let context = {};

      if (token.metadata && token.metadata[TOKEN_METADATA_FIELD_CONTEXT]) {
        context = token.metadata[TOKEN_METADATA_FIELD_CONTEXT];
      }

      const challenge = selectChallenge(challengeType, token.action, { ...context, token });
      return challenge.call(this, token.id);
    })
    .then((challengeResponse) => {
      const response = { regenerated: true };
      const tokenUid = challengeResponse.context.token.uid;

      if (uid) {
        response.uid = tokenUid;
      }

      return response;
    });
}

module.exports = regenerateToken;
