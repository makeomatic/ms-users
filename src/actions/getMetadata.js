const Errors = require('common-errors');
const getMetadata = require('../utils/getMetadata.js');
const redisKey = require('../utils/key.js');

module.exports = function getMetadataAction(message) {
  const { username } = message;
  return this.redis
    .hexists(redisKey(username, 'data'), 'password')
    .then(exists => {
      if (!exists) {
        throw new Errors.HttpStatusError(404, `"${username}" does not exists`);
      }

      return getMetadata.call(this, username, message.audience);
    });
};
