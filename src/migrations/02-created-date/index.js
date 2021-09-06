// This migrations adds created field for existing users
//
const fs = require('fs');

const {
  USERS_INDEX,
  USERS_DATA,
  USERS_METADATA,
  USERS_CREATED_FIELD,
  USERS_NEXT_CYCLE_FIELD,
} = require('../../constants');

const SCRIPT = fs.readFileSync(`${__dirname}/migrate.lua`, 'utf8');

const MIN = 1;
const FINAL = 2;

const ARGS = [
  USERS_CREATED_FIELD,
  USERS_NEXT_CYCLE_FIELD,
  Date.now(),
];

// migration configuration
exports.min = MIN;
exports.final = FINAL;

exports.script = (service) => {
  const { config, redis } = service;
  const audience = config.jwt.defaultAudience;
  const keys = [
    USERS_INDEX,
    `uid!${USERS_DATA}`,
    `uid!${USERS_METADATA}!${audience}`,
  ];

  return redis.eval(SCRIPT, keys.length, keys, ARGS);
};
