// This migrations adds created field for existing users
//
const fs = require('fs');

const {
  USERS_INDEX,
  USERS_DATA,
  USERS_METADATA,
  USERS_CREATED_FIELD,
  USERS_ACTIVATED_FIELD,
  USERS_ACTIVE_FLAG,
} = require('../../constants');

const SCRIPT = fs.readFileSync(`${__dirname}/migrate.lua`, 'utf8');

const MIN = 6;
const FINAL = 7;

const ARGS = [
  USERS_CREATED_FIELD,
  USERS_ACTIVATED_FIELD,
  USERS_ACTIVE_FLAG,
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
