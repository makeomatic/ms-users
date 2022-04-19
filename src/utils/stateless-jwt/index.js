const { RevocationRulesStorage } = require('./rule-storage');
const { RevocationRulesManager } = require('./rule-manager');
const jwt = require('./jwt');
const jwe = require('./jwe');

const trustedHeaders = require('./trusted-headers');

module.exports = {
  rule: {
    RevocationRulesManager,
    RevocationRulesStorage,
  },
  jwt,
  jwe,
  trustedHeaders,
};
