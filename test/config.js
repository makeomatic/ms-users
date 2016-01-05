require('chai').config.includeStack = true;

global.AMQP = {
  connection: {
    host: process.env.RABBITMQ_PORT_5672_TCP_ADDR,
    port: process.env.RABBITMQ_PORT_5672_TCP_PORT,
  },
};

global.REDIS = {
  hosts: [
    {
      host: process.env.REDIS_1_PORT_6379_TCP_ADDR,
      port: process.env.REDIS_1_PORT_6379_TCP_PORT,
    },
    {
      host: process.env.REDIS_2_PORT_6379_TCP_ADDR,
      port: process.env.REDIS_2_PORT_6379_TCP_PORT,
    },
    {
      host: process.env.REDIS_3_PORT_6379_TCP_ADDR,
      port: process.env.REDIS_3_PORT_6379_TCP_PORT,
    },
  ],
};
