const { RedisError } = require('common-errors').data;

/**
 * Selects 'message' prop from Error
 */
const selectProp = (err) => err.message;

/**
 * Handles ioredis pipeline.exec() error
 */
module.exports = function handlePipelineError(args) {
  const errors = [];
  const response = new Array(args.length);

  for (const [idx, [err, res]] of args.entries()) {
    if (err) {
      errors.push(err);
    }

    // collect response no matter what
    response[idx] = res;
  }

  if (errors.length > 0) {
    const message = errors.map(selectProp).join('; ');
    throw new RedisError(message);
  }

  return response;
};
