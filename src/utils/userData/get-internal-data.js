const { HttpStatusError } = require('@microfleet/validation');
const reduce = require('lodash/reduce');
const Promise = require('bluebird');
const zipObject = require('lodash/zipObject');
const resolveUserId = require('./resolve-user-id');
const { USERS_PASSWORD_FIELD, USERS_ID_FIELD, FIELDS_TO_STRINGIFY } = require('../../constants');
const safeParse = require('../safe-parse');

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

function hasAnyData(data) {
  // eslint-disable-next-line no-restricted-syntax
  for (const key in data) {
    if (key !== USERS_ID_FIELD && hasOwnProperty.call(data, key) === true) {
      return true;
    }
  }

  return false;
}

function verifyIdOnly(data) {
  if (data === null) {
    throw new HttpStatusError(404, `"${this.userKey}" does not exist`);
  }
}

function handleNotFound(data) {
  if (data === null || hasAnyData(data) === false) {
    throw new HttpStatusError(404, `"${this.userKey}" does not exist`);
  }
}

function reduceData(data) {
  return reduce(data, reducer, Object.create(null));
}

function getInternalData(userKey, fetchData = true) {
  const { redis } = this;
  const context = { redis, userKey };

  return Promise
    .bind(context, [userKey, fetchData])
    .spread(resolveUserId)
    .tap(fetchData ? handleNotFound : verifyIdOnly)
    .then(reduceData);
}

module.exports = getInternalData;
