const { ErrorTotpRequired } = require('../constants');

function hasTotp({ params, headers }) {
  if (params.totp || headers['X-Auth-TOTP']) {
    return null;
  }

  throw ErrorTotpRequired;
}

module.exports = hasTotp;
