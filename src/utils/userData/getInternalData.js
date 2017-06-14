const { HttpStatusError } = require('common-errors');
const reduce = require('lodash/reduce');
const Promise = require('bluebird');
const resolveUserId = require('./resolveUserId');
const { USERS_PASSWORD_FIELD, FIELDS_TO_STRINGIFY } = require('../../constants');
const safeParse = require('../safeParse');
const zipObject = require('lodash/zipObject');

const hasOwnProperty = Object.prototype.hasOwnProperty;
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
