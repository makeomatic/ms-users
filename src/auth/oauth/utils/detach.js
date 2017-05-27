const get = require('lodash/get');
const Errors = require('common-errors');

const redisKey = require('../../../utils/key');
const updateMetadata = require('../../../utils/updateMetadata');
const handlePipeline = require('../../../utils/pipelineError');

const {
  USERS_SSO_TO_LOGIN,
  USERS_DATA,
} = require('../../../constants');

module.exports = function detach(username, provider, data) {
  const { redis, config } = this;
  const audience = get(config, 'jwt.defaultAudience');
  const userDataKey = redisKey(username, USERS_DATA);
  const pipeline = redis.pipeline();

  const uid = get(data, [provider, 'uid'], false);
  if (!uid) {
    throw Errors.HttpStatusError(412, `${provider} account not found`);
  }

  // delete internal account data
  pipeline.hdel(userDataKey, provider);

  // delete account reference
  pipeline.hdel(USERS_SSO_TO_LOGIN, uid);

  return pipeline.exec().then(handlePipeline)
    .bind(this)
    .return({
      username,
      audience,
      metadata: {
        $remove: [
          provider,
        ],
      },
    })
    .then(updateMetadata);
};
