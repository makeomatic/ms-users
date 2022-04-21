const assert = require('assert');

const addAction = 'revoke-rule.add';
const listAction = 'revoke-rule.list';

describe('#revoke-rule.* actions and RevocationRulesManager', () => {
  before('start', async () => {
    await global.startService.call(this, {
      jwt: {
        stateless: {
          enabled: true,
        },
      },
    });

    await global.clearRedis.call(this, true);
  });

  after('stop', async () => {
    await global.clearRedis.call(this, false);
  });

  it('schema validation', async () => {
    await assert.rejects(this.users.dispatch(addAction, { params: {} }), /data must have required property 'rule'/);

    await assert.rejects(
      this.users.dispatch(addAction, {
        params: {
          rule: {
            _or: true,
            uname: 'some',
            otherFld: {
              xf: 10, // invalid op
            },
          },
        },
      }),
      /compare function is required: xf/
    );

    await assert.rejects(
      this.users.dispatch(addAction, {
        params: {
          rule: {
            otherFld: {
              eq: {}, // valid op, but no object match for now
            },
          },
        },
      }),
      // eslint-disable-next-line max-len
      /data\/rule\/otherFld\/eq must be string, data\/rule\/otherFld must be string, data\/rule\/otherFld must be number, data\/rule\/otherFld must be boolean, data\/rule\/otherFld must match a schema in anyOf/
    );
  });

  it('#add should createglobal rule', async () => {
    const defaultRule = { iss: 'ms-users' };
    const createdRule = await this.users.dispatch(addAction, { params: { rule: defaultRule } });
    const rulesList = await this.users.dispatch(listAction, { params: {} });

    assert.deepStrictEqual(rulesList[0], {
      rule: createdRule.rule,
      params: {
        ...defaultRule.params,
        expireAt: 0,
      },
    });
  });

  it('#update should create user rule', async () => {
    const defaultRule = { iss: 'ms-users-test' };
    const createdRule = await this.users.dispatch(addAction, { params: { username: 'some', rule: defaultRule } });
    const rulesList = await this.users.dispatch(listAction, { params: { username: 'some' } });

    assert.deepStrictEqual(rulesList, [
      {
        rule: createdRule.rule,
        params: {
          ...defaultRule.params,
          expireAt: 0,
        },
      },
    ]);
  });

  it('#list should list global rules', async () => {
    const rules = await this.users.dispatch(listAction, { params: {} });
    assert.strictEqual(rules.length, 1);
  });

  it('#list should list user rules', async () => {
    const rules = await this.users.dispatch(listAction, { params: { username: 'some' } });
    assert.strictEqual(rules.length, 1);
  });

  it('#list should return empty list', async () => {
    const rules = await this.users.dispatch(listAction, { params: { username: 'someonewithoutrules' } });
    assert.deepStrictEqual(rules, []);
  });

  it('#list and #add should cleanup old rules', async () => {
    const defaultRule = { iss: 'ms-users-test' };
    const username = 'sometwo';

    const createRule = (extra) => this.users.dispatch(addAction, {
      params: {
        username,
        rule: {
          ...defaultRule,
          ...extra,
        },
      },
    });

    const expireTime = Math.floor(Date.now() / 1000);
    await createRule({ iss: 'ms-users-global' });
    await createRule({ expireAt: expireTime });

    const redisKey = this.users.revocationRulesManager._getRedisKey(username);
    const redisData = await this.users.redis.zrange(redisKey, 0, -1, 'WITHSCORES');

    assert.deepStrictEqual(redisData, ['{"iss":"ms-users-global"}', '0', '{"iss":"ms-users-test"}', expireTime.toString()]);

    const newExpireTime = expireTime + 1;
    await createRule({ iss: 'ms-users-test-1', expireAt: newExpireTime });

    const rulesAfter = await this.users.dispatch(listAction, { params: { username } });
    const redisAfterData = await this.users.redis.zrange(redisKey, 0, -1, 'WITHSCORES');

    assert.deepStrictEqual(redisAfterData, ['{"iss":"ms-users-global"}', '0', '{"iss":"ms-users-test-1"}', newExpireTime.toString()]);
    assert.deepStrictEqual(rulesAfter, [
      { rule: { iss: 'ms-users-global' }, params: { expireAt: 0 } },
      {
        params: {
          expireAt: newExpireTime,
        },
        rule: {
          iss: 'ms-users-test-1',
        },
      },
    ]);
  });
});
