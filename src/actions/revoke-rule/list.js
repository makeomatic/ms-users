const { ActionTransport } = require('@microfleet/plugin-router');

const { GLOBAL_RULE_GROUP } = require('../../utils/stateless-jwt/rule-manager');

async function listRevokeRules({ params }) {
  const { revocationRulesManager } = this;
  const { username } = params;

  const ruleKey = username || GLOBAL_RULE_GROUP;

  return revocationRulesManager.list(ruleKey);
}

listRevokeRules.transports = [ActionTransport.amqp, ActionTransport.internal];

module.exports = listRevokeRules;
