/**
 * Chat service integration
 * https://github.com/makeomatic/mservice-chat
 * @type {Object}
 */
exports.chat = {
  router: {
    prefix: 'chat',
    routes: {
      'internal.rooms.create': 'internal.rooms.create',
    },
  },
};
