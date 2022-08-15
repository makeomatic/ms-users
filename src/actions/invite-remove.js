const { HttpStatusError } = require('common-errors');
const { ActionTransport } = require('@microfleet/plugin-router');

const {
  INVITATIONS_INDEX,
  USERS_ACTION_INVITE,
} = require('../constants');

/**
 * @api {amqp} <prefix>.invite-remove Generate User Invitation
 * @apiVersion 1.0.0
 * @apiName removeinvite
 * @apiGroup Users
 *
 * @apiDescription Removes existing invitation by it's id. Make sure that only admin can access this route
 *
 * @apiParam (Payload) {Object} id - id of the invitation
 *
 */
module.exports = async function removeInvite({ params }) {
  const { redis, tokenManager } = this;
  const { id } = params;

  try {
    const response = await tokenManager.remove({ id, action: USERS_ACTION_INVITE });
    await redis.srem(INVITATIONS_INDEX, id);
    return response;
  } catch (e) {
    if (e.message === '404') {
      throw new HttpStatusError(404, `Invite with id "${id}" not found`);
    }

    throw e;
  }
};

module.exports.validateResponse = false;
module.exports.transports = [ActionTransport.amqp, ActionTransport.internal];
