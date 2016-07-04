const { HttpStatusError } = require('common-errors');

/**
 * Throttled error
 * @param  {Mixed}  reply
 */
module.exports = function isThrottled(compare) {
  return function comparator(reply) {
    if (!!reply === compare) {
      // eslint-disable-next-line max-len
      throw new HttpStatusError(429, 'We\'ve already sent you an email, if it doesn\'t come - please try again in a little while or send us an email');
    }
  };
};
