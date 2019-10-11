const Errors = require('common-errors');

const errorHelpers = Errors.helpers;

const STATUS_FOREVER = 0;
const RateLimitError = errorHelpers.generateClass('RateLimitError', { args: ['reset', 'limit'] });

module.exports = {
  RateLimitError,
  STATUS_FOREVER,
};
