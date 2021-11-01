const { ActionTransport } = require('@microfleet/core');
const { userRule, globalRule } = require('../../utils/revocation-rules-manager');

async function createOrUpdateRevokeRule({ params }) {
  const { revocationRulesManager } = this;
  const { username, rule: { id, params: ruleParams } } = params;

  const ruleKey = username ? userRule(username, id) : globalRule(id);

  return revocationRulesManager.set(ruleKey, ruleParams, ruleParams.ttl);
}

createOrUpdateRevokeRule.transports = [ActionTransport.amqp, ActionTransport.internal];

module.exports = createOrUpdateRevokeRule;
