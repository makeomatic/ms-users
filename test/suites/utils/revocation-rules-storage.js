const { strictEqual, deepStrictEqual, ok, throws } = require('assert');
const Bluebird = require('bluebird');
const { KEY_PREFIX_REVOCATION_RULES } = require('../../../src/constants');

const withSyncEnabled = {
  revocationRules: {
    enabled: true,
    syncEnabled: true,
  },
};

async function startServiceWithSyncEnabled() {
  await global.startService.bind(this)(withSyncEnabled);
}

describe('#Revocation Rules Sync', function RevocationRulesSyncSuite() {
  const addAction = 'users.revoke-rule.add';

  beforeEach(startServiceWithSyncEnabled);
  afterEach('Clear consul revocation rules version keys', async function clearConsul() {
    const { consul } = this.users;
    await consul.kv.del({ key: KEY_PREFIX_REVOCATION_RULES, recurse: true });
  });
  afterEach(global.clearRedis);

  it('Should throw error when sync has been already started', function test() {
    throws(
      () => this.users.revocationRulesStorage.startSync(),
      /Revocation rules sync has already been started/
    );
  });

  it('Should be able to sync rules', async function test() {
    const { consul, revocationRulesStorage } = this.users;
    const { kv } = consul;
    const initial = await kv.get({ key: KEY_PREFIX_REVOCATION_RULES, recurse: true });
    strictEqual(initial, undefined);
    ok(revocationRulesStorage);
    strictEqual(Object.keys(revocationRulesStorage.getFilter()).length, 0);

    revocationRulesStorage.setCache([], 'some', Date.now() - 100);

    const cache = revocationRulesStorage.getFilter();

    deepStrictEqual(cache.some.rules, []);

    // add new rule - updates version in consul
    const defaultRule = { iss: 'ms-users' };
    await this.dispatch(addAction, { username: 'some', rule: defaultRule });

    // check whether consul key created
    const allKeys = await consul.kv.keys(KEY_PREFIX_REVOCATION_RULES);
    strictEqual(allKeys.length, 1);
    ok(allKeys.includes('revocation-rules/some'));

    // await for the last key sync before stopping watching
    await Bluebird.delay(100);

    deepStrictEqual(cache.some.rules, null);
    console.debug('A', cache);
  });
});
