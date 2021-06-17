const Errors = require('common-errors');

const get = require('../../../utils/get-value');
const UserMetadata = require('../../../utils/metadata/user');
const handlePipeline = require('../../../utils/pipeline-error');

const { USERS_SSO_TO_ID } = require('../../../constants');

module.exports = async function detach(provider, userData) {
  const { id: userId } = userData;
  const { redis, config } = this;
  const audience = get(config, 'jwt.defaultAudience');

  const uid = get(userData, [provider, 'uid'], { default: false });
  if (!uid) {
    throw Errors.HttpStatusError(412, `${provider} account not found`);
  }

  // delete internal account data
  const pipeline = this.userData.delProvider(userId, provider);

  // delete account reference
  pipeline.hdel(USERS_SSO_TO_ID, uid);

  handlePipeline(await pipeline.exec());

  const updateParams = {
    metadata: {
      $remove: [
        provider,
      ],
    },
  };

  return UserMetadata
    .using(userId, audience, redis)
    .batchUpdate(updateParams);
};
