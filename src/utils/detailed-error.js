const { HttpStatusError } = require('common-errors');

function DetailedHttpStatusError(code, msg, reason) {
  const err = new HttpStatusError(code, msg);

  err.reason = reason;
  return err;
}

module.exports = DetailedHttpStatusError;
