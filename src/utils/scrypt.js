const Errors = require('common-errors');
const Promise = require('bluebird');
const scrypt = require('scrypt');
const bytes = require('bytes');

// setup scrypt
const scryptParams = scrypt.paramsSync(0.1, bytes('32mb'));

exports.hash = function hashPassword(password) {
  return Promise.fromNode(function kdfPromise(next) {
    scrypt.kdf(new Buffer(password, 'utf-8'), scryptParams, next);
  });
};

exports.verify = function verifyPassword(hash, password) {
  return Promise.fromNode(function verifyKdfPromise(next) {
    scrypt.verifyKdf(hash, new Buffer(password, 'utf-8'), next);
  }).catch(function scruptError(err) {
    throw new Errors.HttpStatusError(403, err.scrypt_err_message || err.message);
  });
};
