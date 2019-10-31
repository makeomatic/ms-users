const Promise = require('bluebird');
const { ActionTransport } = require('@microfleet/core');
const challenge = require('../utils/challenges/challenge');
const { getInternalData } = require('../utils/userData');
const isActive = require('../utils/is-active');
const isBanned = require('../utils/is-banned');
const hasNotPassword = require('../utils/has-no-password');
const { USERS_ACTION_DISPOSABLE_PASSWORD, USERS_USERNAME_FIELD } = require('../constants');

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
module.exports = function disposablePassword(request) {
  const { challengeType, id } = request.params;
  const { [challengeType]: tokenOptions } = this.config.token;

  return Promise
    .bind(this, id)
    .then(getInternalData)
    .tap(isActive)
    .tap(isBanned)
    .tap(hasNotPassword)
    .then((data) => ([challengeType, {
      id: data[USERS_USERNAME_FIELD],
      action: USERS_ACTION_DISPOSABLE_PASSWORD,
      ...tokenOptions,
    }]))
    .spread(challenge)
    .then((response) => {
      const { uid } = response.context.token;

      return {
        requested: true,
        uid,
      };
    });
};

module.exports.transports = [ActionTransport.amqp, ActionTransport.internal];
