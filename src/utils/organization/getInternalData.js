const { HttpStatusError } = require('common-errors');
const Promise = require('bluebird');
const resolveOrganizationData = require('./resolveOrganizationData');
const { ORGANIZATIONS_ID_FIELD } = require('../../constants');

const { hasOwnProperty } = Object.prototype;

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

function getInternalData(organizationKey, fetchData = true) {
  const { redis } = this;
  const context = { redis, organizationKey };

  return Promise
    .bind(context, [organizationKey, fetchData])
    .spread(resolveOrganizationData)
    .tap(fetchData ? handleNotFound : verifyIdOnly);
}

module.exports = getInternalData;
