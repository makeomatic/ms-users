// This migrations adds created field for existing users
//
const fs = require('fs');
const Promise = require('bluebird');

const {
  USERS_INDEX,
  USERS_DATA,
  USERS_METADATA,
  USERS_CREATED_FIELD,
  USERS_NEXT_CYCLE_FIELD,
} = require('../../constants.js');

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

exports.script = (service, pipeline, versionKey, appendLuaScript) => {
  const audience = service.config.jwt.defaultAudience;
  const lua = appendLuaScript(FINAL, MIN, SCRIPT);
  const keys = [
    versionKey,
    USERS_INDEX,
    `uid!${USERS_DATA}`,
    `uid!${USERS_METADATA}!${audience}`,
  ];

  pipeline.eval(lua, keys.length, keys, ARGS);

  return Promise.resolve(true);
};
