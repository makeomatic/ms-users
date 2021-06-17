const fs = require('fs');
const {
  USERS_INDEX,
  ORGANIZATIONS_INDEX,
  USERS_METADATA,
  ORGANIZATIONS_METADATA,
  USERS_AUDIENCE,
  ORGANIZATIONS_AUDIENCE,
} = require('../../constants');
const getRedisMasterNode = require('../utils/get-redis-master-node');

const SCRIPT = fs.readFileSync(`${__dirname}/migrate.lua`, 'utf8');
const USERS_KEYS = [
  USERS_INDEX,
  `id!${USERS_METADATA}!`,
  `id!${USERS_AUDIENCE}`,
];
const USERS_ARGS = [
  `.*id!${USERS_METADATA}!`,
];
const ORGANIZATIONS_KEYS = [
  ORGANIZATIONS_INDEX,
  `id!${ORGANIZATIONS_METADATA}!`,
  `id!${ORGANIZATIONS_AUDIENCE}`,
];
const ORGANIZATIONS_ARGS = [
  `.*id!${USERS_METADATA}!`,
];

const script = async ({ config, redis }) => {
  const masterNode = getRedisMasterNode(redis, config);

  await masterNode.eval(SCRIPT, USERS_KEYS.length, USERS_KEYS, USERS_ARGS);
  await masterNode.eval(SCRIPT, ORGANIZATIONS_KEYS.length, ORGANIZATIONS_KEYS, ORGANIZATIONS_ARGS);
};

module.exports = {
  script,
  min: 8,
  final: 9,
};
