const get = require('lodash/get');
const redisKey = require('../../../utils/key');
const UserMetadata = require('../../../utils/metadata/user');
const handlePipeline = require('../../../utils/pipeline-error');
const {
  USERS_SSO_TO_ID,
  USERS_DATA,
} = require('../../../constants');

module.exports = async function attach(account, user) {
  const { redis, config } = this;
  const { id: userId } = user;
  const {
    uid, provider, internals, profile,
  } = account;
  const audience = get(config, 'jwt.defaultAudience');
  const userDataKey = redisKey(userId, USERS_DATA);
  const pipeline = redis.pipeline();

  // inject private info to user internal data
  pipeline.hset(userDataKey, provider, JSON.stringify(internals));

  // link uid to user id
  pipeline.hset(USERS_SSO_TO_ID, uid, userId);

  await pipeline.exec().then(handlePipeline);

  const userMetadata = new UserMetadata(redis);
  const updateParams = {
    userId,
    audience,
    metadata: {
      $set: {
        [provider]: profile,
      },
    },
  };
  await userMetadata.batchUpdate(updateParams);

  return profile;
};
