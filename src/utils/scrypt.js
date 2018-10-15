const Errors = require('common-errors');
const Promise = require('bluebird');
const scrypt = Promise.promisifyAll(require('scrypt'));
const bytes = require('bytes');
const assert = require('assert');
const { USERS_INCORRECT_PASSWORD } = require('../constants');

// setup scrypt
const scryptParams = scrypt.paramsSync(0.1, bytes('32mb'));
const kUnacceptableVerificationMethod = new Errors.HttpStatusError(423, 'unacceptable verification method');

exports.hash = function hashPassword(password) {
  if (!password) {
    throw new Errors.HttpStatusError(500, 'invalid password passed');
  }

  return scrypt.kdfAsync(Buffer.from(password), scryptParams);
};

exports.verify = function verifyPassword(hash, password) {
  if (Buffer.isBuffer(hash)) {
    return Promise.reject(kUnacceptableVerificationMethod);
  }

  return Promise
    .try(() => {
      assert.ok(password, 'password arg must be present');
      return [hash, Buffer.from(password)];
    })
    .spread(scrypt.verifyKdfAsync)
    .catch(function scryptError(err) {
      throw new Errors.HttpStatusError(403, err.message || err.scrypt_err_message);
    })
    .then(function verifyResult(result) {
      if (result !== true) {
        throw USERS_INCORRECT_PASSWORD;
      }

      return result;
    });
};

exports.scrypt = scrypt;
