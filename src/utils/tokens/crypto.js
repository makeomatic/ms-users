const { HttpStatusError } = require('common-errors');
const URLSafeBase64 = require('urlsafe-base64');
const crypto = require('crypto');

/**
 * Creates (de)cipher
 * @param  {Boolean} isDecipher
 * @return {Function}
 */
const createCipher =
exports.createCipher = function createCipher(isDecipher) {
  const thunk = crypto[isDecipher ? 'createDecipher' : 'createCipher'];
  return (algorithm, secret, buffer) => {
    const cipher = thunk(algorithm, secret);
    return Buffer.concat([cipher.update(buffer), cipher.final()]);
  };
};

/**
 * Encrypts buffer using alg and secret
 * @param  {String} algorithm
 * @param  {String} secret
 * @param  {Buffer} buffer
 * @return {Buffer}
 */
const encrypt = exports.encrypt = createCipher(false);

/**
 * Decrypts buffer using algoruthm and secret
 * @param  {String} algorithm
 * @param  {String} secret
 * @param  {Buffer} buffer
 * @return {Buffer}
 */
const decrypt = exports.decrypt = createCipher(true);

/**
 * Safely decodes
 * @param  {String} algorithm
 * @param  {String} secret
 * @param  {String} string
 * @return {Promise}
 */
exports.safeDecode = function safeDecode(algorithm, secret, string) {
  return Promise
    .try(() => JSON.parse(decrypt(algorithm, secret, URLSafeBase64.decode(string))))
    .catch(err => {
      this.log.warn('cant decode token', err);
      throw new HttpStatusError(403, 'could not decode token');
    });
};

/**
 * Encodes obj or string into URLSafe format, encrypting token alongside it
 * @param  {String} algorithm
 * @param  {String} secret
 * @param  {String|Object} _data
 * @return {String}
 */
exports.safeEncode = function safeEncode(algorithm, secret, id, token) {
  const data = JSON.stringify({ id, token });
  return URLSafeBase64.encode(encrypt(algorithm, secret, Buffer.from(data)));
};
