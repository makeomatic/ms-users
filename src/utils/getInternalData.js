const Errors = require('common-errors');
const redisKey = require('../utils/key.js');
const handlePipeline = require('../utils/pipelineError.js');
const reduce = require('lodash/reduce');
const {
  USERS_DATA,
  USERS_ALIAS_TO_LOGIN,
  USERS_PASSWORD_FIELD,
  USERS_USERNAME_FIELD,
} = require('../constants.js');

const hasOwnProperty = Object.prototype.hasOwnProperty;
const reducer = (accumulator, value, prop) => {
  if (hasOwnProperty.call(accumulator, prop)) {
    return accumulator;
  }

  if (prop === USERS_PASSWORD_FIELD) {
    accumulator[prop] = value;
  } else {
    accumulator[prop] = value.toString();
  }

  return accumulator;
};

module.exports = function getInternalData(username) {
  const { redis } = this;
  const userKey = redisKey(username, USERS_DATA);

  return redis
    .pipeline()
    .hget(USERS_ALIAS_TO_LOGIN, username.toLowerCase())
    .exists(userKey)
    .hgetallBuffer(userKey)
    .exec()
    .then(handlePipeline)
    .spread((aliasToUsername, exists, data) => {
      if (aliasToUsername) {
        return getInternalData.call(this, aliasToUsername);
      }

      if (!exists) {
        throw new Errors.HttpStatusError(404, `"${username}" does not exists`);
      }

      return reduce(data, reducer, { [USERS_USERNAME_FIELD]: username });
    });
};
