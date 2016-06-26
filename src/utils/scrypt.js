const Promise = require('bluebird');
const scrypt = Promise.promisifyAll(require('scrypt'));
const bytes = require('bytes');
const { ModelError, ERR_PASSWORD_INVALID, ERR_PASSWORD_INCORRECT,
  ERR_PASSWORD_SCRYPT_ERROR, ERR_PASSWORD_INVALID_HASH } = require('../model/modelError');

// setup scrypt
const scryptParams = scrypt.paramsSync(0.1, bytes('32mb'));

exports.hash = function hashPassword(password) {
  if (!password) {
    throw new ModelError(ERR_PASSWORD_INVALID);
  }

  return scrypt.kdfAsync(Buffer.from(password), scryptParams);
};

exports.verify = function verifyPassword(hash, password) {
  if (!Buffer.isBuffer(hash) || hash.length === 0) {
    throw new ModelError(ERR_PASSWORD_INVALID_HASH);
  }

  return scrypt
    .verifyKdfAsync(hash, Buffer.from(password))
    .catch(function scryptError(err) {
      throw new ModelError(ERR_PASSWORD_SCRYPT_ERROR, err);
    })
    .then(function verifyResult(result) {
      if (result !== true) {
        throw new ModelError(ERR_PASSWORD_INCORRECT);
      }
    });
};

exports.scrypt = scrypt;
