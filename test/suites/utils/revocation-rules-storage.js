const { strictEqual, deepStrictEqual, ok, throws } = require('assert');
const Bluebird = require('bluebird');
const { KEY_PREFIX_REVOCATION_RULES } = require('../../../src/constants');
const { Rule } = require('../../../src/utils/radix-filter/rule');
const { RuleGroup } = require('../../../src/utils/radix-filter/rule-group');

const withSyncEnabled = { invocationRulesStorage: { syncEnabled: true } };
async function startServiceWithSyncEnabled() {
  await global.startService.bind(this)(withSyncEnabled);
}

describe('#Revocation Rules Sync', function RevocationRulesSyncSuite() {
  beforeEach(startServiceWithSyncEnabled);
  afterEach('Clear consul revocation rules keys', async function clearConsul() {
    const { consul } = this.users;
    await consul.kv.del({ key: KEY_PREFIX_REVOCATION_RULES, recurse: true });
  });
  afterEach(global.clearRedis);

  it('Should throw error when sync has been already started', function test() {
    throws(
      this.users.revocationRulesStorage.startSync,
      'Revocation rules sync has already been started'
    );
  });

  it('Should be able to sync rules', async function test() {
    const { consul, revocationRulesStorage } = this.users;
    const { kv } = consul;
    const initial = await kv.get({ key: KEY_PREFIX_REVOCATION_RULES, recurse: true });
    strictEqual(initial, undefined);
    ok(revocationRulesStorage);
    strictEqual(revocationRulesStorage.getFilter().rules.length(), 0);

    await kv.set(`${KEY_PREFIX_REVOCATION_RULES}001`, JSON.stringify({ rule: 1 }));
    await kv.del(`${KEY_PREFIX_REVOCATION_RULES}001`);
    await kv.set(`${KEY_PREFIX_REVOCATION_RULES}002`, JSON.stringify({ rule: 2 }));
    await kv.set(`${KEY_PREFIX_REVOCATION_RULES}003`, JSON.stringify({ rule: 3 }));
    await kv.set(`${KEY_PREFIX_REVOCATION_RULES}003`, JSON.stringify({ rule: 3.1 }));
    await kv.set(`${KEY_PREFIX_REVOCATION_RULES}003`, JSON.stringify({ rule: 3.2 }));

    // await for the last key sync before stopping watching
    await Bluebird.delay(100);

    const { rules } = this.users.revocationRulesStorage.getFilter();

    strictEqual(rules.length(), 2);

    deepStrictEqual(rules.get('list:002'), new RuleGroup(new Rule('rule', 'eq', 2)));
    deepStrictEqual(rules.get('list:003'), new RuleGroup(new Rule('rule', 'eq', 3.2)));

    const allKeys = await consul.kv.keys(KEY_PREFIX_REVOCATION_RULES);
    strictEqual(allKeys.length, 2);
    ok(allKeys.includes('revocation-rules/002'));
    ok(allKeys.includes('revocation-rules/003'));

    await kv.del(`${KEY_PREFIX_REVOCATION_RULES}002`);
    await kv.del(`${KEY_PREFIX_REVOCATION_RULES}003`);

    await Bluebird.delay(2);

    strictEqual(revocationRulesStorage.getFilter().rules.length(), 0);
  });
});
