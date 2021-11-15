const { ActionTransport } = require('@microfleet/core');
const { NotFoundError } = require('common-errors');
const { userRule, globalRule } = require('../../utils/revocation-rules-manager');

async function deleteRevokeRule({ params }) {
  const { revocationRulesManager } = this;
  const { username, rule } = params;

  const ruleKey = username ? userRule(username, rule) : globalRule(rule);

  const dbRule = await revocationRulesManager.get(ruleKey);

  if (!dbRule) {
    throw NotFoundError(`rule: ${rule}: ${ruleKey}`);
  }

  await revocationRulesManager.batchDelete([ruleKey]);
}

deleteRevokeRule.transports = [ActionTransport.amqp, ActionTransport.internal];

module.exports = deleteRevokeRule;
