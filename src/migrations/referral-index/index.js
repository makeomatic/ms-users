// This migrations adds created field for existing users
//
const fs = require('fs');

const {
  USERS_INDEX,
  USERS_REFERRAL_INDEX,
  USERS_REFERRAL_FIELD,
  USERS_METADATA,
} = require('../../constants.js');

const SCRIPT = fs.readFileSync(`${__dirname}/migrate.lua`, 'utf8');

const MIN = 1;
const FINAL = 3;

// migration configuration
exports.min = MIN;
exports.final = FINAL;

const ARGS = [
  USERS_REFERRAL_FIELD,
];

exports.script = (service, pipeline, versionKey, appendLuaScript) => {
  const prefix = service.config.router.prefix;
  const audience = service.config.jwt.defaultAudience;
  const list = `${prefix}.list`;

  return service.router
    .dispatch(list, {
      audience,
      keyOnly: true,
      public: false,
      filter: {
        [USERS_REFERRAL_FIELD]: {
          exists: 1,
        },
      },
    })
    .then(key => key.slice(prefix.length))
    .then((userIdsKey) => {
      const keys = [
        versionKey,
        USERS_INDEX,
        userIdsKey,
        `uid!${USERS_METADATA}!${audience}`,
        `${USERS_REFERRAL_INDEX}:uid`,
      ];

      const lua = appendLuaScript(FINAL, MIN, SCRIPT);
      pipeline.eval(lua, keys.length, keys, ARGS);
      return null;
    });
};
