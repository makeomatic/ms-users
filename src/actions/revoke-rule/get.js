const { ActionTransport } = require('@microfleet/core');
const { NotFoundError } = require('common-errors');
const { userRule, globalRule, extractRule } = require('../../utils/revocation-rules-manager');

async function getRevokeRule({ params }) {
  const { revocationRulesManager } = this;
  const { username, rule } = params;

  const ruleKey = username ? userRule(username, rule) : globalRule(rule);

  const dbRule = await revocationRulesManager.get(ruleKey);
  if (!dbRule) {
    throw NotFoundError(`rule: ${rule}: ${ruleKey}`);
  }

  return extractRule(dbRule);
}

getRevokeRule.transports = [ActionTransport.amqp, ActionTransport.internal];

module.exports = getRevokeRule;
