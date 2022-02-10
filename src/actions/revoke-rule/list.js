const { ActionTransport } = require('@microfleet/core');

const { GLOBAL_RULE_GROUP } = require('../../utils/revocation-rules-manager');

async function listRevokeRules({ params }) {
  const { revocationRulesManager } = this;
  const { username } = params;

  const ruleKey = username || GLOBAL_RULE_GROUP;

  return revocationRulesManager.list(ruleKey);
}

listRevokeRules.transports = [ActionTransport.amqp, ActionTransport.internal];

module.exports = listRevokeRules;
