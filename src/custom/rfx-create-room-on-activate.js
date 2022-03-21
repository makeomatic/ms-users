const is = require('is');
const Promise = require('bluebird');
const setMetadata = require('../utils/update-metadata');

/**
 * @param  {String} username
 * @param  {Object} params
 * @return {Promise}
 */
async function createRoom(userId, params, metadata) {
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

  const room = await amqp.publishAndWait(route, roomParams, { timeout: 5000 });

  const update = {
    userId,
    audience,
    metadata: {
      $set: {
        stationChatId: room.id,
      },
    },
  };

  return setMetadata.call(this, update);
}

module.exports = createRoom;
