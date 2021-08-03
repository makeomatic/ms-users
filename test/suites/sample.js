const { strictEqual, ok } = require('assert');
const Bluebird = require('bluebird');

describe('#Consul Sample', function AMQPSuite() {
  beforeEach(global.startService);
  const KEY_PREFIX_INVOCATION_RULES = 'invocation-rules/';
  afterEach('Clear consul invocation rules keys', async function clearConsul() {
    const { consul } = this.users;
    await consul.kv.del({ key: KEY_PREFIX_INVOCATION_RULES, recurse: true });
  });
  afterEach(global.clearRedis);

  const kvGetChangeCallback = (service) => async (data) => {
    const value = data === undefined ? null : data;
    service.log.debug({ value }, 'Syncing invocation rules');
    service.invocationRules = value;
  };

  const errorCallback = (service) => (err) => {
    service.log.error({ err }, 'Consul watch error');
  };

  it.skip('watch sample', async function test() {
    const { consul } = this.users;
    const { kv } = consul;
    const initial = await kv.get({ key: KEY_PREFIX_INVOCATION_RULES, recurse: true });
    strictEqual(initial, undefined);

    const watch = consul.watch({
      method: kv.get,
      options: { key: KEY_PREFIX_INVOCATION_RULES, recurse: true },
      backoffFactor: 0,
    });
    watch.on('change', kvGetChangeCallback(this.users));
    watch.on('error', errorCallback(this.users));

    await kv.set(`${KEY_PREFIX_INVOCATION_RULES}001`, 'i am rule 001');
    await kv.del(`${KEY_PREFIX_INVOCATION_RULES}001`);
    await kv.set(`${KEY_PREFIX_INVOCATION_RULES}002`, 'i am rule 002');
    await kv.set(`${KEY_PREFIX_INVOCATION_RULES}003`, 'i am rule 003');
    await kv.set(`${KEY_PREFIX_INVOCATION_RULES}003`, 'i am rule 003 updated');
    await kv.set(`${KEY_PREFIX_INVOCATION_RULES}003`, 'i am rule 003 updated once again');

    // await for the last key sync before stopping watching
    await Bluebird.delay(10);
    watch.end();

    const { invocationRules: rules } = this.users;
    strictEqual(rules.length, 2);
    strictEqual(rules[0].Key, 'invocation-rules/002');
    strictEqual(rules[0].Value, 'i am rule 002');
    strictEqual(rules[1].Key, 'invocation-rules/003');
    strictEqual(rules[1].Value, 'i am rule 003 updated once again');

    const allKeys = await consul.kv.keys(KEY_PREFIX_INVOCATION_RULES);
    strictEqual(allKeys.length, 2);
    ok(allKeys.includes('invocation-rules/002'));
    ok(allKeys.includes('invocation-rules/003'));
  });

  it('control keys ttl with sessions', async function test() {
    const { consul } = this.users;
    const { kv } = consul;
    const initial = await kv.get({ key: KEY_PREFIX_INVOCATION_RULES, recurse: true });
    strictEqual(initial, undefined);
    const session = await consul.session.create({
      // this `name` is NOT unique, you may have several active sessions with same name
      name: 'human readable name for session',
      lockdelay: '1s',
      ttl: '10s',
      behavior: 'delete',
    });
    const { ID: sessionId } = session;

    const watch = consul.watch({
      method: kv.get,
      options: { key: KEY_PREFIX_INVOCATION_RULES, recurse: true },
      backoffFactor: 0,
    });
    watch.on('change', kvGetChangeCallback(this.users));
    watch.on('error', errorCallback(this.users));

    const sessionOpts = {
      acquire: sessionId,
      // release: sessionId,
    };

    await consul.kv.set({
      key: `${KEY_PREFIX_INVOCATION_RULES}001`,
      value: 'i am rule 001',
      ...sessionOpts,
    });
    await Bluebird.delay(10);
    await kv.del(`${KEY_PREFIX_INVOCATION_RULES}001`);
    await Bluebird.delay(10);
    await kv.set({
      key: `${KEY_PREFIX_INVOCATION_RULES}002`,
      value: 'i am rule 002',
      ...sessionOpts,
    });
    await Bluebird.delay(10);
    await kv.set({
      key: `${KEY_PREFIX_INVOCATION_RULES}003`,
      value: 'i am rule 003',
      ...sessionOpts,
    });
    await Bluebird.delay(10);
    await kv.set({
      key: `${KEY_PREFIX_INVOCATION_RULES}003`,
      value: 'i am rule 003 updated',
      ...sessionOpts,
    });
    await Bluebird.delay(10);
    await kv.set({
      key: `${KEY_PREFIX_INVOCATION_RULES}003`,
      value: 'i am rule 003 updated once again',
      ...sessionOpts,
    });

    ok(await consul.session.get(sessionId), 'Active session not found: maybe it has been destroyed or invalidated');

    console.log('get session before ttl expiration', await consul.session.get(sessionId));

    // await session ttl expiration
    await Bluebird.delay(10 * 1000);

    // const destroySession = await consul.session.destroy(sessionId);
    // console.log('destroySession', destroySession);

    console.log('get session after 10 seconds', await consul.session.get(sessionId));

    await Bluebird.delay(1000);

    console.log('get session after 11 seconds', await consul.session.get(sessionId));

    await Bluebird.delay(1000);

    console.log('get session after 12 seconds', await consul.session.get(sessionId));

    await Bluebird.delay(1000);

    console.log('get session after 13 seconds', await consul.session.get(sessionId));

    await Bluebird.delay(1000);

    console.log('get session after 14 seconds', await consul.session.get(sessionId));

    await Bluebird.delay(1000);

    console.log('get session after 15 seconds', await consul.session.get(sessionId));

    await Bluebird.delay(1000);

    console.log('get session after 16 seconds', await consul.session.get(sessionId));

    await Bluebird.delay(1000);

    console.log('get session after 17 seconds', await consul.session.get(sessionId));

    await Bluebird.delay(1000);

    console.log('get session after 18 seconds', await consul.session.get(sessionId));

    await Bluebird.delay(1000);

    console.log('get session after 19 seconds', await consul.session.get(sessionId));

    await Bluebird.delay(1000);

    console.log('get session after 20 seconds', await consul.session.get(sessionId));
    strictEqual(await consul.session.get(sessionId), undefined);

    // await last watch sync
    await Bluebird.delay(10);

    // stop watch
    watch.end();

    const currentState = await kv.get({ key: KEY_PREFIX_INVOCATION_RULES, recurse: true });
    console.log('currentState', currentState);
  }, 30000);

  it('destroy session manually', async function test() {
    const { consul } = this.users;
    const { kv } = consul;
    const initial = await kv.get({ key: KEY_PREFIX_INVOCATION_RULES, recurse: true });
    strictEqual(initial, undefined);
    const session = await consul.session.create({
      // this `name` is NOT unique, you may have several active sessions with same name
      name: 'human readable name for session',
      lockdelay: '1s',
      ttl: '10s',
      behavior: 'delete',
    });
    const { ID: sessionId } = session;

    const watch = consul.watch({
      method: kv.get,
      options: { key: KEY_PREFIX_INVOCATION_RULES, recurse: true },
      backoffFactor: 0,
    });
    watch.on('change', kvGetChangeCallback(this.users));
    watch.on('error', errorCallback(this.users));

    const sessionOpts = {
      acquire: sessionId,
      // release: sessionId,
    };

    await consul.kv.set({
      key: `${KEY_PREFIX_INVOCATION_RULES}001`,
      value: 'i am rule 001',
      ...sessionOpts,
    });
    await Bluebird.delay(10);
    await kv.del(`${KEY_PREFIX_INVOCATION_RULES}001`);
    await Bluebird.delay(10);
    await kv.set({
      key: `${KEY_PREFIX_INVOCATION_RULES}002`,
      value: 'i am rule 002',
      ...sessionOpts,
    });
    await Bluebird.delay(10);
    await kv.set({
      key: `${KEY_PREFIX_INVOCATION_RULES}003`,
      value: 'i am rule 003',
      ...sessionOpts,
    });
    await Bluebird.delay(10);
    await kv.set({
      key: `${KEY_PREFIX_INVOCATION_RULES}003`,
      value: 'i am rule 003 updated',
      ...sessionOpts,
    });
    await Bluebird.delay(10);
    await kv.set({
      key: `${KEY_PREFIX_INVOCATION_RULES}003`,
      value: 'i am rule 003 updated once again',
      ...sessionOpts,
    });

    ok(await consul.session.get(sessionId), 'Active session not found: maybe it has been destroyed or invalidated');

    console.log('get session before destroy', await consul.session.get(sessionId));

    const destroySession = await consul.session.destroy(sessionId);
    console.log('destroySession', destroySession);

    // await last watch sync
    await Bluebird.delay(10);

    // stop watch
    watch.end();

    const currentState = await kv.get({ key: KEY_PREFIX_INVOCATION_RULES, recurse: true });
    console.log('currentState', currentState);
  }, 30000);
});

describe('#ETCD Sample', () => {

});
