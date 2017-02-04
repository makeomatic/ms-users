/**
 * Specifies configuration for AMQP / RabbitMQ lib
 * @type {Object} amqp
 */
exports.amqp = {
  transport: {
    queue: 'ms-users',
  },
  router: {
    enabled: true,
  },
};
