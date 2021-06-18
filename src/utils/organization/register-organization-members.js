/* eslint-disable no-mixed-operators */
const Promise = require('bluebird');
const generatePassword = require('password-generator');
const handlePipeline = require('../pipeline-error');
const {
  USERS_CREATED_FIELD,
  USERS_USERNAME_FIELD,
  USERS_ACTIVE_FLAG,
  USERS_PASSWORD_FIELD,
  USERS_ACTIVATED_FIELD,
  USERS_USERNAME_TO_ID,
  USERS_INDEX,
  USERS_ID_FIELD,
} = require('../../constants.js');
const scrypt = require('../scrypt');
const UserMetadata = require('../metadata/user');

async function registerOrganizationMember(member) {
  const { redis, config } = this;
  const { pwdReset, jwt: { defaultAudience: audience } } = config;
  const { email } = member;

  const userId = this.flake.next();
  const createdAt = Date.now();
  const basicInfo = {
    [USERS_CREATED_FIELD]: createdAt,
    [USERS_USERNAME_FIELD]: email,
    [USERS_ACTIVE_FLAG]: true,
  };
  const password = member.password || generatePassword(pwdReset.length, pwdReset.memorable);
  basicInfo[USERS_PASSWORD_FIELD] = await scrypt.hash(password);

  const pipeline = this.userData.registerInOrganization(userId, basicInfo);
  pipeline.hset(USERS_USERNAME_TO_ID, email, userId);
  handlePipeline(await pipeline.exec());

  await UserMetadata
    .using(userId, audience, redis)
    .batchUpdate({
      metadata: [{
        $set: {
          [USERS_ID_FIELD]: userId,
          [USERS_USERNAME_FIELD]: email,
          [USERS_CREATED_FIELD]: basicInfo[USERS_CREATED_FIELD],
          [USERS_ACTIVATED_FIELD]: createdAt,
        },
      }],
    });

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
  return Promise.all(members.map((member) => registerOrganizationMember.call(this, member)));
}

module.exports = registerOrganizationMembers;
