const Promise = require('bluebird');
const { selectChallenge } = require('../utils/challenges/challenge');

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

  return Promise.bind(tokenManager, args)
    .tap(tokenManager.regenerate)
    .then(tokenManager.info)
    .bind(this)
    .then(token => {
      const challenge = selectChallenge(challengeType, token.action, { token });
      return challenge.call(this, token.id);
    })
    .then(challengeResponse => {
      const response = { regenerated: true };
      const tokenUid = challengeResponse.context.token.uid;

      if (uid) {
        response.uid = tokenUid;
      }

      return response;
    });
}

module.exports = regenerateToken;
