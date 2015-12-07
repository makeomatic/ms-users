const Errors = require('common-errors');
const updateMetadata = require('../utils/updateMetadata.js');
const redisKey = require('../utils/key.js');

module.exports = function updateMetadataAction(message) {
  const { username } = message;
  return this.redis
    .hexists(redisKey(username, 'data'), 'password')
    .then(exists => {
      if (!exists) {
        throw new Errors.HttpStatusError(404, `"${username}" does not exists`);
      }

      return updateMetadata.call(this, message);
    });
};
