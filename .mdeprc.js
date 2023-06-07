const fs = require('fs')
const uid = process.getuid()
const { execSync } = require('child_process')

try {
  const dockerHost = execSync(
    "docker context inspect -f '{{ .Endpoints.docker.Host }}'",
    { encoding: 'utf-8' })

  const socket = dockerHost.replace(/^unix:\/+/, '/').replace(/\n/, '')
  process.env.DOCKER_SOCKET_PATH = socket
} catch (e) { }

exports.node = "18";
exports.in_one = false;
exports.auto_compose = true;
exports.with_local_compose = true;
exports.tester_flavour = "chrome-tester";
exports.rebuild = ['ms-flakeless'];
exports.nycCoverage = false;
exports.nycReport = false;
exports.docker_compose = './test/docker-compose.yml';
exports.test_framework = 'mocha';
exports.extras = {
  tester: {
    user: `${uid}:${uid}`,
    shm_size: '256m',
    volumes: ['${PWD}/test/configs:/configs:cached'],
    expose: ['3000'],
    environment: {
      NODE_ENV: "test",
      DB_SRV: "${DB_SRV:-}",
      CI: "${CI:-}",
      DEBUG: "${DEBUG:-''}",
      NCONF_NAMESPACE: 'MS_USERS',
      PUPPETEER_SKIP_CHROMIUM_DOWNLOAD: 1,
      VIRTUAL_HOST: 'ms-users.local',
      VIRTUAL_PORT: 3000,
      CERT_NAME: 'default',
      SKIP_FB: process.env.SKIP_FB,
      NODE_V8_COVERAGE: 'coverage/tmp'
    },
  },
};

exports.pre = 'rimraf ./coverage/tmp';
exports.post_exec = 'pnpm exec -- c8 report -r text -r lcov';

switch (process.env.DB_SRV) {
  case 'redisCluster':
    exports.services = ['rabbitmq', 'redisCluster'];
    exports.extras.tester.environment.NCONF_FILE_PATH = '["/configs/amqp.js","/configs/core.js","/configs/redis.cluster.js"]';
    break;
  case 'redisSentinel':
    exports.services = ['rabbitmq', 'redisSentinel'];
    exports.extras.tester.environment.NCONF_FILE_PATH = '["/configs/amqp.js","/configs/core.js","/configs/redis.sentinel.js"]';
    // exports.extras.redis = {
      // ports: ["6379:6379"]
    // };
    break;
}

if (fs.existsSync('.env')) {
  exports.extras.tester.env_file = ['${PWD}/.env']
} else {
  Object.assign(exports.extras.tester.environment, {
    FACEBOOK_APP_TOKEN: '${FACEBOOK_APP_TOKEN}',
    FACEBOOK_CLIENT_ID: '${FACEBOOK_CLIENT_ID}',
    FACEBOOK_CLIENT_SECRET: '${FACEBOOK_CLIENT_SECRET}',
    PUMP_JACK_PROFILE_TOKEN: '${PUMP_JACK_PROFILE_TOKEN}',
    PUMP_JACK_API_KEY: '${PUMP_JACK_API_KEY}',
    MASTERS_SIMULATION_API: '${MASTERS_SIMULATION_API}',
    MASTERS_PROFILE_USERNAME: '${MASTERS_PROFILE_USERNAME}',
    MASTERS_PROFILE_PASSWORD: '${MASTERS_PROFILE_PASSWORD}',
    CF_TOKEN: '${CF_TOKEN}',
    CF_ACCOUNT_ID: '${CF_ACCOUNT_ID}',
  })
}
