const { HttpStatusError } = require('common-errors');
const reduce = require('lodash/reduce');
const Promise = require('bluebird');
const zipObject = require('lodash/zipObject');
const resolveOrganizationId = require('./resolveOrganizationId');
const { ORGANIZATIONS_ID_FIELD, FIELDS_TO_STRINGIFY } = require('../../constants');
const safeParse = require('../safeParse');

const { hasOwnProperty } = Object.prototype;
const STRINGIFY_FIELDS = zipObject(FIELDS_TO_STRINGIFY);

const reducer = (accumulator, value, prop) => {
  if (hasOwnProperty.call(accumulator, prop)) {
    return accumulator;
  }

  if (hasOwnProperty.call(STRINGIFY_FIELDS, prop)) {
    accumulator[prop] = safeParse(value);
  } else {
    accumulator[prop] = value.toString();
  }

  return accumulator;
};

function hasAnyData(data) {
  // eslint-disable-next-line no-restricted-syntax
  for (const key in data) {
    if (key !== ORGANIZATIONS_ID_FIELD && hasOwnProperty.call(data, key) === true) {
      return true;
    }
  }

  return false;
}

function verifyIdOnly(data) {
  if (data === null) {
    throw new HttpStatusError(404, `"${this.organizationKey}" does not exist`);
  }
}

function handleNotFound(data) {
  if (data === null || hasAnyData(data) === false) {
    throw new HttpStatusError(404, `"${this.organizationKey}" does not exist`);
  }
}

function reduceData(data) {
  return reduce(data, reducer, {});
}

function getInternalData(organizationKey, fetchData = true) {
  const { redis } = this;
  const context = { redis, organizationKey };

  return Promise
    .bind(context, [organizationKey, fetchData])
    .spread(resolveOrganizationId)
    .tap(fetchData ? handleNotFound : verifyIdOnly)
    .then(reduceData);
}

module.exports = getInternalData;
