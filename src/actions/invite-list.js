const Promise = require('bluebird');
const fsort = require('redis-filtered-sort');
const is = require('is');
const {
  INVITATIONS_INDEX,
  USERS_ACTION_INVITE,
} = require('../constants.js');

/**
 * @api {amqp} <prefix>.invite-list Retrieve list of sent invitations
 * @apiVersion 1.0.0
 * @apiName InviteList
 * @apiGroup Users
 *
 * @apiDescription This method allows to retrieve sent invitations
 *
 * @apiParam (Payload) {Number} [offset=0] - cursor for pagination
 * @apiParam (Payload) {Number} [limit=10] - profiles per page
 * @apiParam (Payload) {String="ASC","DESC"} [order=ASC] - sort order
 * @apiParam (Payload) {String} [criteria] - if supplied, sort will be performed based on this field
 * @apiParam (Payload) {Object} [filter] to use, consult https://github.com/makeomatic/redis-filtered-sort, can already be stringified
 */
function iterateOverInvites(request) {
  const { redis, tokenManager } = this;
  const { criteria, filter } = request.params;
  const strFilter = is.string(filter) ? filter : fsort.filter(filter || {});
  const order = request.params.order || 'ASC';
  const offset = request.params.offset || 0;
  const limit = request.params.limit || 10;
  const metaKey = tokenManager.backend.key(USERS_ACTION_INVITE, '*');

  return redis
    .fsort(INVITATIONS_INDEX, metaKey, criteria, order, strFilter, Date.now(), offset, limit)
    .then((ids) => {
      const length = +ids.pop();
      if (length === 0 || ids.length === 0) {
        return [
          [],
          [],
          length,
        ];
      }

      return Promise.join(
        Promise.all(ids.map(id => tokenManager.info({ id, action: USERS_ACTION_INVITE }))),
        length
      );
    })
    .spread((invites, length) => ({
      invites,
      cursor: offset + limit,
      page: Math.floor(offset / limit) + 1,
      pages: Math.ceil(length / limit),
    }));
}

module.exports = iterateOverInvites;
