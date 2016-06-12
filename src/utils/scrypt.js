const Errors = require('common-errors');
const Promise = require('bluebird');
const scrypt = Promise.promisifyAll(require('scrypt'));
const bytes = require('bytes');

// setup scrypt
const scryptParams = scrypt.paramsSync(0.1, bytes('32mb'));

exports.hash = function hashPassword(password) {
  if (!password) {
    throw new Errors.HttpStatusError(500, 'invalid password passed');
  }

  return scrypt.kdfAsync(Buffer.from(password), scryptParams);
};

exports.verify = function verifyPassword(hash, password) {
  return scrypt
    .verifyKdfAsync(hash, Buffer.from(password))
    .catch(function scryptError(err) {
      throw new Errors.HttpStatusError(403, err.message || err.scrypt_err_message);
    })
    .then(function verifyResult(result) {
      if (result !== true) {
        throw new Errors.HttpStatusError(403, 'incorrect password');
      }
    });
};

exports.scrypt = scrypt;
