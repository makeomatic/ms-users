const Promise = require('bluebird');

const DetailedHttpStatusError = require('./detailed-error');
const {
  USERS_ACTIVE_FLAG,
  USERS_USERNAME_FIELD,
  USERS_TEMP_ACTIVATED_TIME_FIELD,
} = require('../constants.js');

function makeNotActiveError(username) {
  return DetailedHttpStatusError(412, 'Account hasn\'t been activated', { username });
}

/**
 * Used if you need a boolean
 * @param {Object} config - ms-users config
 * @param {Object} userData - user internal data
 * @returns {boolean}
 */
function isActive(config, userData) {
  const { temporaryActivation } = config;
  const temporaryActivatedTime = userData[USERS_TEMP_ACTIVATED_TIME_FIELD];

  if (temporaryActivatedTime !== undefined) {
    if ((parseInt(temporaryActivatedTime, 10) + temporaryActivation.validTimeMs) >= Date.now()) {
      return true;
    }

    return false;
  }

  return String(userData[USERS_ACTIVE_FLAG]) === 'true';
}

/**
 * Used if you need to throw an error
 * @param {Object} config - ms-users config
 * @param {Object} userData - user internal data
 * @returns {Promise<Object>} - user internal data
 */
function assertIsActive(config, userData) {
  if (isActive(config, userData) === false) {
    throw makeNotActiveError(userData[USERS_USERNAME_FIELD]);
  }
}

/**
 * Helper for using with bluebird promise chain
 * @param {Object} userData - user internal data
 * @this {Microfleet} - instance of Microfleet
 * @throws {DetailedHttpStatusError}
 * @returns {Object} - user internal data
 */
function isActiveTap(userData) {
  const { config } = this;

  if (isActive(config, userData) === false) {
    return Promise.reject(makeNotActiveError(userData[USERS_USERNAME_FIELD]));
  }

  return Promise.resolve(userData);
}

module.exports = {
  isActive,
  assertIsActive,
  isActiveTap,
  makeNotActiveError,
};
