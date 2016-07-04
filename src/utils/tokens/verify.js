const { safeDecode } = require('./crypto.js');
const { HttpStatusError } = require('common-errors');
const { SECRETS_NAMESPACE } = require('../../constants.js');
const key = require('../key.js');

/**
 * Verifies token
 * @param  {String}  string
 * @param  {String}  namespace
 * @param  {Boolean} expire
 * @return {Promise}
 */
module.exports = function verify(string, namespace, expires) {
  const { redis, config } = this;
  const { validation } = config;
  const { secret: sharedSecret, algorithm } = validation;

  return safeDecode
    .call(this, algorithm, sharedSecret, string)
    .then(message => {
      const { id, token } = message;

      if (!id || !token) {
        throw new HttpStatusError(403, 'Decoded token misses references to id and/or secret');
      }

      const secretKey = key(SECRETS_NAMESPACE, namespace, token);

      return redis
        .get(secretKey)
        .then(storedId => {
          if (!storedId) {
            throw new HttpStatusError(404, 'token expired or is invalid');
          }

          if (storedId !== id) {
            throw new HttpStatusError(412, 'associated email doesn\'t match token');
          }

          if (expires) {
            return redis.del(secretKey);
          }

          return null;
        })
        .return(id);
    });
};
