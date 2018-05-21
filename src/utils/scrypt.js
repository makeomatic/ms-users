const Errors = require('common-errors');
const Promise = require('bluebird');
const scrypt = Promise.promisifyAll(require('scrypt'));
const bytes = require('bytes');
const assert = require('assert');
const { USERS_INCORRECT_PASSWORD } = require('../constants');

// setup scrypt
const scryptParams = scrypt.paramsSync(0.1, bytes('32mb'));

function hashPassword(password) {
  if (!password) {
    throw new Errors.HttpStatusError(500, 'invalid password passed');
  }

  return scrypt.kdfAsync(Buffer.from(password), scryptParams);
}

exports.hashString = function hashStringPassword(password, encoding) {
  return hashPassword(password)
    .then(res => res.toString(encoding));
};

exports.verify = function verifyPassword(hash, password) {
  return Promise
    .try(() => {
      assert.ok(Buffer.isBuffer(hash), '`hash` must be a buffer');
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

exports.hash = hashPassword;
exports.scrypt = scrypt;
