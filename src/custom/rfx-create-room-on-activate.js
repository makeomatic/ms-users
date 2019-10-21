const is = require('is');
const Promise = require('bluebird');
const UpdateUserMetadata = require('../utils/metadata/update-user-metadata');

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

  const updateMetadata = new UpdateUserMetadata(this.redis);

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

      return updateMetadata.update(updateParams);
    });
}

module.exports = createRoom;
