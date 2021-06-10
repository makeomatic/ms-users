const {
  USERS_INDEX,
  ORGANIZATIONS_INDEX,
  USERS_METADATA,
  ORGANIZATIONS_METADATA,
  USERS_AUDIENCE,
  ORGANIZATIONS_AUDIENCE,
} = require('../../constants');
const Audience = require('../../utils/metadata/redis/audience');

const script = async ({ config, redis, log }) => {
  const { keyPrefix } = config.redis.options;
  const usersAudience = new Audience(redis, USERS_AUDIENCE);
  const organizationAudience = new Audience(redis, ORGANIZATIONS_AUDIENCE);

  const process = (audience, metadata) => (ids) => {
    ids.forEach((id) => {
      const prefix = `${keyPrefix}${id}!${metadata}!`;
      redis.keys(`*${prefix}*`)
        .map((key) => key.replace(prefix, ''))
        .map((audienceString) => {
          return audience.add(id, audienceString);
        });
    });
  };

  await redis.smembers(USERS_INDEX)
    .tap(({ length }) => log.info('Users to be processed:', length))
    .map(process(usersAudience, USERS_METADATA));

  await redis.smembers(ORGANIZATIONS_INDEX)
    .tap(({ length }) => log.info('Organizations to be processed:', length))
    .map(process(organizationAudience, ORGANIZATIONS_METADATA));
};

module.exports = {
  script,
  min: 8,
  final: 9,
};
