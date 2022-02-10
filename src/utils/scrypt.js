const { HttpStatusError } = require('common-errors');
const Scrypt = require('scrypt-kdf');
const { strict: assert } = require('assert');
const bytes = require('bytes');
const { USERS_INCORRECT_PASSWORD } = require('../constants');

const scryptParams = Scrypt.pickParams(0.1, bytes('32mb'));
const kUnacceptableVerificationMethod = new HttpStatusError(423, 'unacceptable verification method');
const kInvalidPasswordPassedError = new HttpStatusError(500, 'invalid password passed');

exports.hash = async function hashPassword(password) {
  if (!password) {
    throw kInvalidPasswordPassedError;
  }

  return Scrypt.kdf(password, scryptParams);
};

exports.verify = async function verifyPassword(hash, password) {
  if (Buffer.isBuffer(hash) === false) {
    throw kUnacceptableVerificationMethod;
  }

  assert(password, 'password arg must be present');

  let isValid = false;
  try {
    isValid = await Scrypt.verify(hash, password);
  } catch (err) {
    throw new HttpStatusError(403, err.message || err.scrypt_err_message);
  }

  if (isValid !== true) {
    throw USERS_INCORRECT_PASSWORD;
  }

  return isValid;
};
