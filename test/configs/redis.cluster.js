exports.redis = {
  hosts: Array.from({ length: 3 }).map((_, i) => ({
    host: 'redis-cluster',
    port: 7000 + i,
  })),
};

/**
 * Enables plugins. This is a minimum list
 * @type {Array}
 */
exports.plugins = [
  'validator',
  'logger',
  'router',
  'router-amqp',
  'router-hapi',
  'amqp',
  'redis-cluster',
  'hapi',
  'dlock',
  'prometheus',
  'signed-request',
];
