const { ActionTransport } = require('@microfleet/core');
const { userRule, globalRule } = require('../../utils/revocation-rules-manager');

async function getRevokeRule({ params }) {
  const { revocationRulesManager } = this;
  const { user, rule } = params;
  const { ttl } = rule;

  const ruleKey = user ? userRule(user, rule, ttl) : globalRule(rule);

  return revocationRulesManager.get(ruleKey);
}

getRevokeRule.transports = [ActionTransport.amqp, ActionTransport.internal];

module.exports = getRevokeRule;
