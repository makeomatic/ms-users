// This migrations adds created field for existing users
//
const fs = require('fs');

const {
  USERS_INDEX,
  USERS_REFERRAL_INDEX,
  USERS_REFERRAL_FIELD,
  USERS_METADATA,
} = require('../../constants');

const SCRIPT = fs.readFileSync(`${__dirname}/migrate.lua`, 'utf8');

const MIN = 1;
const FINAL = 3;

// migration configuration
exports.min = MIN;
exports.final = FINAL;

const ARGS = [
  USERS_REFERRAL_FIELD,
];

exports.script = (service) => {
  const { config, redis } = service;
  const audience = config.jwt.defaultAudience;
  const prefix = config.redis.options.keyPrefix;
  const request = {
    params: {
      audience,
      keyOnly: true,
      public: false,
      filter: {
        [USERS_REFERRAL_FIELD]: {
          exists: 1,
        },
      },
    },
  };

  return service
    .dispatch('list', request)
    .then((key) => key.slice(prefix.length))
    .then((userIdsKey) => {
      const keys = [
        USERS_INDEX,
        userIdsKey,
        `uid!${USERS_METADATA}!${audience}`,
        `${USERS_REFERRAL_INDEX}:uid`,
      ];

      return redis.eval(SCRIPT, keys.length, keys, ARGS);
    });
};
