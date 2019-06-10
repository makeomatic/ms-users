/* eslint-disable no-mixed-operators */
const Promise = require('bluebird');
const generatePassword = require('password-generator');
const redisKey = require('../key.js');
const handlePipeline = require('../pipelineError.js');
const {
  USERS_CREATED_FIELD,
  USERS_USERNAME_FIELD,
  USERS_ACTIVE_FLAG,
  USERS_PASSWORD_FIELD,
  USERS_DATA,
  USERS_USERNAME_TO_ID,
  USERS_INDEX,
} = require('../../constants.js');

async function registerOrganizationMember(member) {
  const { redis, config } = this;
  const { pwdReset } = config;
  const { email } = member;

  const userId = this.flake.next();
  const pipeline = redis.pipeline();
  const basicInfo = {
    [USERS_CREATED_FIELD]: Date.now(),
    [USERS_USERNAME_FIELD]: email,
    [USERS_ACTIVE_FLAG]: true,
  };
  const password = generatePassword(pwdReset.length, pwdReset.memorable);
  basicInfo[USERS_PASSWORD_FIELD] = password;

  const userDataKey = redisKey(userId, USERS_DATA);
  pipeline.hmset(userDataKey, basicInfo);
  pipeline.hset(USERS_USERNAME_TO_ID, email, userId);
  await pipeline.exec().then(handlePipeline);

  // perform instant activation
  // internal username index
  const regPipeline = redis.pipeline().sadd(USERS_INDEX, userId);

  return regPipeline
    .exec()
    .then(handlePipeline)
    // custom actions
    .bind(this)
    .return(['users:activate', userId])
    .spread(this.hook)
    .return({ ...member, id: userId, password });
}

function registerOrganizationMembers(members) {
  return Promise.all(members.map(member => registerOrganizationMember.call(this, member)));
}

module.exports = registerOrganizationMembers;
