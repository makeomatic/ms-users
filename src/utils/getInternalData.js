const { HttpStatusError } = require('common-errors');
const reduce = require('lodash/reduce');
const redisKey = require('../utils/key.js');
const resolveUserId = require('./resolveUserId');
const Promise = require('bluebird');
const {
  USERS_DATA,
  USERS_ALIAS_TO_ID,
  USERS_PASSWORD_FIELD,
  USERS_USERNAME_FIELD,
} = require('../constants.js');

function reducer(accumulator, value, prop) {
  if (prop === USERS_PASSWORD_FIELD) {
    accumulator[prop] = value;
  } else {
    // @TODO why toString()?
    accumulator[prop] = value.toString();
  }

  return accumulator;
};

function handleNotFound(data) {
  if (data === null) {
    throw new HttpStatusError(404, `"${this.userKey}" does not exists`);
  }
}

function reduceData(data) {
  return reduce(data, reducer, {});
}

function getInternalData(userKey, fetchData = true) {
  const { redis } = this;
  const context = { redis, userKey };

  return Promise
    .bind(context, [userKey, fetchData])
    .spread(resolveUserId)
    .tap(handleNotFound)
    .then(reduceData);
};

module.exports = getInternalData;
