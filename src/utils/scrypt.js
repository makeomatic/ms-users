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

  return scrypt.kdfAsync(new Buffer(password, 'utf-8'), scryptParams);
};

exports.verify = function verifyPassword(hash, password) {
  if (!Buffer.isBuffer(hash) || hash.length === 0) {
    throw new Errors.HttpStatusError(500, 'invalid password hash retrieved from redis');
  }

  return scrypt
    .verifyKdfAsync(hash, new Buffer(password, 'utf-8'))
    .catch(function scryptError(err) {
      throw new Errors.HttpStatusError(403, err.scrypt_err_message || err.message);
    })
    .then(function verifyResult(result) {
      if (result !== true) {
        throw new Errors.HttpStatusError(403, 'incorrect password');
      }
    });
};
