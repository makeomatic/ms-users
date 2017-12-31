const get = require('lodash/get');
const redisKey = require('../../../utils/key');
const updateMetadata = require('../../../utils/updateMetadata');
const handlePipeline = require('../../../utils/pipelineError');
const {
  USERS_SSO_TO_LOGIN,
  USERS_DATA,
} = require('../../../constants');

module.exports = function attach(account, user) {
  const { redis, config } = this;
  const { username } = user;
  const {
    uid, provider, internals, profile,
  } = account;
  const audience = get(config, 'jwt.defaultAudience');
  const userDataKey = redisKey(username, USERS_DATA);
  const pipeline = redis.pipeline();

  // inject private info to user internal data
  pipeline.hset(userDataKey, provider, JSON.stringify(internals));

  // link uid to username
  pipeline.hset(USERS_SSO_TO_LOGIN, uid, username);

  return pipeline.exec().then(handlePipeline)
    .bind(this)
    .return({
      username,
      audience,
      metadata: {
        $set: {
          [provider]: profile,
        },
      },
    })
    .then(updateMetadata)
    .return(profile);
};
