const { HttpStatusError } = require('common-errors');

const challenge = require('./challenges/challenge');
const {
  ErrorConflictUserExists,
  ErrorUserNotFound,
  USERS_ACTION_UPDATE_USERNAME,
  USERS_DATA,
  USERS_INVALID_TOKEN,
  USERS_METADATA,
  USERS_USERNAME_FIELD,
  USERS_USERNAME_TO_ID,
} = require('../constants');
const redisKey = require('./key');

const Error500 = new HttpStatusError(500, 'something went wrong');

const requestUsernameUpdate = async (service, userId, username, challengeType, context) => {
  const { config } = service;
  const tokenConfig = config.token[challengeType];
  const challengeOpts = {
    ...tokenConfig,
    action: USERS_ACTION_UPDATE_USERNAME,
    id: username,
    metadata: { userId },
  };

  const response = await challenge.call(service, challengeType, challengeOpts, { ...context });

  return {
    uid: response.context.token.uid,
  };
};

const updateUsername = ({ redis, config }, userId, username) => {
  const { jwt: { defaultAudience } } = config;

  if (!userId || !username || !defaultAudience) {
    throw Error500;
  }

  return redis
    .updateUsername(
      3,
      redisKey(userId, USERS_DATA),
      redisKey(userId, USERS_METADATA, defaultAudience),
      USERS_USERNAME_TO_ID,
      userId,
      username,
      USERS_USERNAME_FIELD,
      JSON.stringify(username)
    )
    .catch((error) => {
      if (error.message === ErrorConflictUserExists.code) {
        throw ErrorConflictUserExists;
      }

      if (error.message === ErrorUserNotFound.code) {
        throw ErrorUserNotFound;
      }

      throw Error500;
    });
};

const updateUsernameWithToken = async (service, token, username) => {
  const { metadata: { userId } } = await service.tokenManager
    .verify({
      action: USERS_ACTION_UPDATE_USERNAME,
      id: username,
      token,
    })
    .catch(() => {
      throw USERS_INVALID_TOKEN;
    });

  await updateUsername(service, userId, username);
};

module.exports = {
  requestUsernameUpdate,
  updateUsernameWithToken,
};
