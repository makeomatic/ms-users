const is = require('is');
const Promise = require('bluebird');
const UserMetadata = require('../utils/metadata/user');

/**
 * @param  {String} username
 * @param  {Object} params
 * @return {Promise}
 */
function createRoom(userId, params, metadata) {
  const { audience, inviteToken } = params;

  if (is.undefined(inviteToken)) {
    return Promise.resolve();
  }

  const { amqp, config } = this;
  const { router } = config.chat;
  const route = `${router.prefix}.${router.routes['internal.rooms.create']}`;
  const roomParams = {
    createdBy: userId,
    name: `${metadata[audience].stationName} | ${metadata[audience].stationSchool}`,
  };

  const userMetadata = new UserMetadata(this.redis);

  return amqp.publishAndWait(route, roomParams, { timeout: 5000 })
    .bind(this)
    .then((room) => {
      const updateParams = {
        userId,
        audience,
        metadata: {
          $set: {
            stationChatId: room.id,
          },
        },
      };

      return userMetadata.batchUpdate(updateParams);
    });
}

module.exports = createRoom;
