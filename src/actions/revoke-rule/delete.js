const { ActionTransport } = require('@microfleet/core');
const { userRule, globalRule } = require('../../utils/revocation-rules-manager');

async function deleteRevokeRule({ params }) {
  const { revocationRulesManager } = this;
  const { user, rule } = params;

  const ruleKey = user ? userRule(user, rule) : globalRule(rule);

  const dbRule = revocationRulesManager.get(ruleKey);

  if (dbRule) {
    await revocationRulesManager.batchDelete([ruleKey]);
  }
}

deleteRevokeRule.transports = [ActionTransport.amqp, ActionTransport.internal];

module.exports = deleteRevokeRule;
