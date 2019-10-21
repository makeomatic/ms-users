const Errors = require('common-errors');

const get = require('../../../utils/get-value');
const redisKey = require('../../../utils/key');
const UpdateUserMetadata = require('../../../utils/metadata/update-user-metadata');
const handlePipeline = require('../../../utils/pipelineError');

const {
  USERS_SSO_TO_ID,
  USERS_DATA,
} = require('../../../constants');

module.exports = async function detach(provider, userData) {
  const { id: userId } = userData;
  const { redis, config } = this;
  const audience = get(config, 'jwt.defaultAudience');
  const userDataKey = redisKey(userId, USERS_DATA);
  const pipeline = redis.pipeline();

  const uid = get(userData, [provider, 'uid'], { default: false });
  if (!uid) {
    throw Errors.HttpStatusError(412, `${provider} account not found`);
  }

  // delete internal account data
  pipeline.hdel(userDataKey, provider);

  // delete account reference
  pipeline.hdel(USERS_SSO_TO_ID, uid);

  await pipeline.exec().then(handlePipeline);

  const updateMetadata = new UpdateUserMetadata(redis);
  const updateParams = {
    userId,
    audience,
    metadata: {
      $remove: [
        provider,
      ],
    },
  };

  return updateMetadata.update(updateParams);
};
