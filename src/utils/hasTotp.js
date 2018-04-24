const Errors = require('common-errors');

function hasTotp({ params, headers }) {
  if (params.totp || headers['X-Auth-TOTP']) {
    return null;
  }

  throw new Errors.HttpStatusError(403, 'TOTP required');
}

module.exports = hasTotp;
