const { RedisError } = require('common-errors').data;

/**
 * Handles ioredis pipeline.exec() error
 */
module.exports = function handlePipelineError(args) {
  const errors = [];
  const response = new Array(args.length);
  args.forEach((data, idx) => {
    const [err, res] = data;
    if (err) {
      errors.push(err);
    }

    // collect response no matter what
    response[idx] = res;
  });

  if (errors.length > 0) {
    const message = errors.map(err => err.message).join('; ');
    throw new RedisError(message);
  }

  return response;
};
