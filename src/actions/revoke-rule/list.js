const { ActionTransport } = require('@microfleet/core');

const { userRule, globalRule, extractRule } = require('../../utils/revocation-rules-manager');

async function listRevokeRules({ params }) {
  const { revocationRulesManager } = this;
  const { user } = params;

  const ruleKey = user ? userRule(user, '') : globalRule('');

  const raw = await revocationRulesManager.list(ruleKey, true);
  return raw.map((data) => extractRule(data));
}

listRevokeRules.transports = [ActionTransport.amqp, ActionTransport.internal];

module.exports = listRevokeRules;
