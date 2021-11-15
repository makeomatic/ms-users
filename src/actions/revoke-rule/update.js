const { ActionTransport } = require('@microfleet/core');
const { v4 } = require('uuid');
const { RuleGroup } = require('../../utils/radix-filter/rule-group');
const { userRule, globalRule } = require('../../utils/revocation-rules-manager');

async function createOrUpdateRevokeRule({ params }) {
  const { revocationRulesManager } = this;
  const { username, rule: { id = v4(), params: ruleParams } } = params;
  const { ttl, ...restParams } = ruleParams;
  const ruleKey = username ? userRule(username, id) : globalRule(id);

  // try to create rule and check whether it meets requirements
  RuleGroup.create(restParams);

  await revocationRulesManager.set(ruleKey, JSON.stringify(restParams), ttl);
  return { rule: id };
}

createOrUpdateRevokeRule.transports = [ActionTransport.amqp, ActionTransport.internal];

module.exports = createOrUpdateRevokeRule;
