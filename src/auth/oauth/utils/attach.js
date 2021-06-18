const get = require('lodash/get');
const UserMetadata = require('../../../utils/metadata/user');
const handlePipeline = require('../../../utils/pipeline-error');
const {
  USERS_SSO_TO_ID,
} = require('../../../constants');

module.exports = async function attach(account, user) {
  const { redis, config } = this;
  const { id: userId } = user;
  const {
    uid, provider, internals, profile,
  } = account;
  const audience = get(config, 'jwt.defaultAudience');
  const pipeline = this.userData.attachProvider(userId, provider, internals);

  // link uid to user id
  pipeline.hset(USERS_SSO_TO_ID, uid, userId);

  handlePipeline(await pipeline.exec());

  const updateParams = {
    metadata: {
      $set: {
        [provider]: profile,
      },
    },
  };
  await UserMetadata
    .using(userId, audience, redis)
    .batchUpdate(updateParams);

  return profile;
};
