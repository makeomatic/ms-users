const Errors = require('common-errors');
const redisKey = require('../utils/key.js');
const handlePipeline = require('../utils/pipelineError.js');
const safeParse = require('../utils/safeParse.js');
const reduce = require('lodash/reduce');
const zipObject = require('lodash/zipObject');
const {
  USERS_DATA,
  USERS_SSO_TO_LOGIN,
  USERS_ALIAS_TO_LOGIN,
  USERS_PASSWORD_FIELD,
  USERS_USERNAME_FIELD,
  FIELDS_TO_STRINGIFY,
} = require('../constants.js');

const { hasOwnProperty } = Object.prototype;
const STRINGIFY_FIELDS = zipObject(FIELDS_TO_STRINGIFY);

const reducer = (accumulator, value, prop) => {
  if (hasOwnProperty.call(accumulator, prop)) {
    return accumulator;
  }

  if (prop === USERS_PASSWORD_FIELD) {
    accumulator[prop] = value;
  } else if (hasOwnProperty.call(STRINGIFY_FIELDS, prop)) {
    accumulator[prop] = safeParse(value);
  } else {
    accumulator[prop] = value.toString();
  }

  return accumulator;
};

module.exports = function getInternalData(username) {
  const { redis } = this;
  const userKey = redisKey(username, USERS_DATA);
  return redis.pipeline()
    .hget(USERS_ALIAS_TO_LOGIN, username.toLowerCase())
    .hget(USERS_SSO_TO_LOGIN, username)
    .exists(userKey)
    .hgetallBuffer(userKey)
    .exec()
    .then(handlePipeline)
    .spread((aliasToUsername, ssoToUsername, exists, data) => {
      if (aliasToUsername) {
        return getInternalData.call(this, aliasToUsername);
      }

      if (ssoToUsername) {
        return getInternalData.call(this, ssoToUsername);
      }

      if (!exists) {
        throw new Errors.HttpStatusError(404, `"${username}" does not exists`);
      }

      return reduce(data, reducer, { [USERS_USERNAME_FIELD]: username });
    });
};
