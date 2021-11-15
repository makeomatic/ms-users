const { ActionTransport } = require('@microfleet/core');

const { userRule, globalRule, extractRule } = require('../../utils/revocation-rules-manager');

async function listRevokeRules({ params }) {
  const { revocationRulesManager } = this;
  const { username } = params;

  const ruleKey = username ? userRule(username, '') : globalRule('');

  const raw = await revocationRulesManager.list(ruleKey, true);
  return raw.map((data) => extractRule(data));
}

listRevokeRules.transports = [ActionTransport.amqp, ActionTransport.internal];

module.exports = listRevokeRules;
