const { HttpStatusError } = require('common-errors');
const reduce = require('lodash/reduce');
const Promise = require('bluebird');
const resolveUserId = require('./resolveUserId');
const { USERS_PASSWORD_FIELD } = require('../../constants');

function reducer(accumulator, value, prop) {
  if (prop === USERS_PASSWORD_FIELD) {
    accumulator[prop] = value;
  } else {
    accumulator[prop] = value.toString();
  }

  return accumulator;
}

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
}

module.exports = getInternalData;
