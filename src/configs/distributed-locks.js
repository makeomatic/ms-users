/**
 * Configuratin for https://github.com/AVVS/distributed-callback-queue
 * This is used to avoid race conditions across microservices on concurrent requests
 * @type {Object}
 */
exports.lockManager = {
  lockPrefix: 'dlock!',
  pubsubChannel: '{ms-users}:dlock',
  lock: {
    timeout: 15000,
    retries: 1,
    delay: 50,
  },
};
