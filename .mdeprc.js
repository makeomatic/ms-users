exports.node = "14.13";
exports.auto_compose = true;
exports.with_local_compose = true;
exports.tester_flavour = "chrome-tester";
exports.rebuild = ['ms-flakeless'];

switch (process.env.DB_SRV) {
  case 'redisCluster':
    exports.services = ['rabbitmq', 'redisCluster'];
    exports.docker_compose = './test/docker-compose.yml';
    break;
  case 'redisSentinel':
    exports.services = ['rabbitmq', 'redisSentinel'];
    exports.docker_compose = './test/docker-compose.sentinel.yml';
    break;
}
