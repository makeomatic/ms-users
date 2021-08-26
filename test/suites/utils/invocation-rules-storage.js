const { strictEqual, ok, throws } = require('assert');
const Bluebird = require('bluebird');
const { KEY_PREFIX_INVOCATION_RULES } = require('../../../src/constants');

const withSyncEnabled = { invocationRulesStorage: { syncEnabled: true } };
async function startServiceWithSyncEnabled() {
  await global.startService.bind(this)(withSyncEnabled);
}

describe('#Invocation Rules Sync', function InvocationRulesSyncSuite() {
  beforeEach(startServiceWithSyncEnabled);
  afterEach('Clear consul invocation rules keys', async function clearConsul() {
    const { consul } = this.users;
    await consul.kv.del({ key: KEY_PREFIX_INVOCATION_RULES, recurse: true });
  });
  afterEach(global.clearRedis);

  it('Should throw error when sync has been already started', function test() {
    throws(
      this.users.invocationRulesStorage.startSync,
      'Invocation rules sync has already been started'
    );
  });

  it('Should be able to sync rules', async function test() {
    const { consul, invocationRulesStorage } = this.users;
    const { kv } = consul;
    const initial = await kv.get({ key: KEY_PREFIX_INVOCATION_RULES, recurse: true });
    strictEqual(initial, undefined);
    ok(invocationRulesStorage);
    strictEqual(invocationRulesStorage.getRules(), null);

    await kv.set(`${KEY_PREFIX_INVOCATION_RULES}001`, 'i am rule 001');
    await kv.del(`${KEY_PREFIX_INVOCATION_RULES}001`);
    await kv.set(`${KEY_PREFIX_INVOCATION_RULES}002`, 'i am rule 002');
    await kv.set(`${KEY_PREFIX_INVOCATION_RULES}003`, 'i am rule 003');
    await kv.set(`${KEY_PREFIX_INVOCATION_RULES}003`, 'i am rule 003 updated');
    await kv.set(`${KEY_PREFIX_INVOCATION_RULES}003`, 'i am rule 003 updated once again');

    // await for the last key sync before stopping watching
    await Bluebird.delay(1);

    const rules = this.users.invocationRulesStorage.getRules();
    strictEqual(rules.length, 2);
    strictEqual(rules[0].Key, 'invocation-rules/002');
    strictEqual(rules[0].Value, 'i am rule 002');
    strictEqual(rules[1].Key, 'invocation-rules/003');
    strictEqual(rules[1].Value, 'i am rule 003 updated once again');

    const allKeys = await consul.kv.keys(KEY_PREFIX_INVOCATION_RULES);
    strictEqual(allKeys.length, 2);
    ok(allKeys.includes('invocation-rules/002'));
    ok(allKeys.includes('invocation-rules/003'));

    await kv.del(`${KEY_PREFIX_INVOCATION_RULES}002`);
    await kv.del(`${KEY_PREFIX_INVOCATION_RULES}003`);

    await Bluebird.delay(2);

    const rulesAfterDeletion = this.users.invocationRulesStorage.getRules();
    strictEqual(rulesAfterDeletion, null);
  });
});
