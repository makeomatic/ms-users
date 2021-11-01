const { ActionTransport } = require('@microfleet/core');

const { userRule, globalRule } = require('../../utils/revocation-rules-manager');

async function listRevokeRules({ params }) {
  const { revocationRulesManager } = this;
  const { user } = params;

  const ruleKey = user ? userRule(user, '') : globalRule('');

  const raw = await revocationRulesManager.list(ruleKey);
  const parsed = raw.map((data) => ({ ...data, Value: JSON.parse(data.Value) }));

  return parsed;
}

listRevokeRules.transports = [ActionTransport.amqp, ActionTransport.internal];

module.exports = listRevokeRules;
