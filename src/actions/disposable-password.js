const challenge = require('../utils/challenges/challenge');
const getInternalData = require('../utils/getInternalData');
const isActive = require('../utils/isActive');
const isBanned = require('../utils/isBanned');
const hasNotPassword = require('../utils/hasNotPassword');
const Promise = require('bluebird');
const { USERS_ACTION_DISPOSABLE_PASSWORD } = require('../constants');

/**
 * @api {amqp} <prefix>.disposable-password Request disposable password
 * @apiVersion 1.0.0
 * @apiName DisposablePassword
 * @apiGroup Users
 *
 * @apiDescription This method allowes to get disposable password.
 *
 * @apiSchema {jsonschema=../../schemas/disposable-password.json} apiParam
 */
function disposablePassword(request) {
  const { challengeType, id } = request.params;
  const { [challengeType]: tokenOptions } = this.config.token;

  return Promise
    .bind(this, id)
    .then(getInternalData)
    .tap(isActive)
    .tap(isBanned)
    .tap(hasNotPassword)
    .then(data => ([challengeType, {
      id: data.username,
      action: USERS_ACTION_DISPOSABLE_PASSWORD,
      ...tokenOptions,
    }]))
    .spread(challenge)
    .then(response => {
      const uid = response.context.token.uid;

      return {
        requested: true,
        uid,
      };
    });
}

module.exports = disposablePassword;
