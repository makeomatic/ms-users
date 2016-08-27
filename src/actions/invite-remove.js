const { HttpStatusError } = require('common-errors');
const {
  INVITATIONS_INDEX,
  USERS_ACTION_INVITE,
} = require('../constants.js');

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
module.exports = function removeInvite(request) {
  const { redis, tokenManager } = this;
  const { id } = request.params;

  return tokenManager
    .remove({ id, action: USERS_ACTION_INVITE })
    .tap(() => redis.srem(INVITATIONS_INDEX, id))
    .catch({ message: 404 }, () => {
      throw new HttpStatusError(404, `Invite with id "${id}" not found`);
    });
};
