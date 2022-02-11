const { ActionTransport } = require('@microfleet/plugin-router');
const { RuleGroup } = require('../../utils/radix-filter/rule-group');
const { GLOBAL_RULE_GROUP } = require('../../utils/revocation-rules-manager');

async function addRevokeRule({ params }) {
  const { revocationRulesManager } = this;
  const { username, rule } = params;
  const { ttl, ...restRule } = rule;
  const ruleKey = username || GLOBAL_RULE_GROUP;

  // try to create rule and check whether it meets requirements
  RuleGroup.create(restRule);

  await revocationRulesManager.add(ruleKey, JSON.stringify(restRule), ttl);
  return { rule };
}

addRevokeRule.transports = [ActionTransport.amqp, ActionTransport.internal];

module.exports = addRevokeRule;
