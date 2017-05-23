const get = require('lodash/get');

const redisKey = require('../key.js');
const updateMetadata = require('../updateMetadata.js');
const handlePipeline = require('../pipelineError.js');

const {
  USERS_SSO_TO_LOGIN,
  USERS_DATA,
} = require('../../constants.js');

module.exports = function detach(username, provider, account) {
  const { redis, config } = this;

  const { uid } = account;
  const audience = get(config, 'jwt.defaultAudience');
  const userDataKey = redisKey(username, USERS_DATA);
  const pipeline = redis.pipeline();

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
    .then(updateMetadata)
    .return({});
};
