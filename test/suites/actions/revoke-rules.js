const assert = require('assert');

const addAction = 'users.revoke-rule.add';
const listAction = 'users.revoke-rule.list';

describe('#revoke-rule.* actions and RevocationRulesManager', () => {
  before('start', async () => {
    await global.startService.call(this, {
      revocationRules: {
        enabled: true,
        syncEnabled: true,
      },
    });

    await global.clearRedis.call(this, true);
  });

  after('stop', async () => {
    await global.clearRedis.call(this, false);
  });

  it('schema validation', async () => {
    await assert.rejects(this.dispatch(addAction, {}), /data should have required property 'rule'/);
    // await assert.rejects(this.dispatch(addAction, { rule: {} }), /data.rule should have required property 'params'/);

    await assert.rejects(
      this.dispatch(addAction, {
        rule: {
          _or: true,
          uname: 'some',
          otherFld: {
            xf: 10, // invalid op
          },
        },
      }),
      /compare function is required: xf/
    );

    await assert.rejects(
      this.dispatch(addAction, {
        rule: {
          otherFld: {
            eq: {}, // valid op, but no object match for now
          },
        },
      }),
      // eslint-disable-next-line max-len
      /data.rule\['otherFld'\].eq should be string, data.rule\['otherFld'\] should be string, data.rule\['otherFld'\] should be number, data.rule\['otherFld'\] should be boolean, data.rule\['otherFld'\] should match some schema in anyOf/
    );
  });

  it('#add should createglobal rule', async () => {
    const defaultRule = { iss: 'ms-users' };
    const createdRule = await this.dispatch(addAction, { rule: defaultRule });
    const rulesList = await this.dispatch(listAction, { });

    console.debug(rulesList);

    assert.deepStrictEqual(rulesList[0], {
      rule: createdRule.rule,
      params: {
        ...defaultRule.params,
        ttl: 0,
      },
    });
  });

  it('#update should create user rule', async () => {
    const defaultRule = { iss: 'ms-users-test' };
    const createdRule = await this.dispatch(addAction, { username: 'some', rule: defaultRule });
    const rulesList = await this.dispatch(listAction, { username: 'some' });

    console.debug(rulesList);

    assert.deepStrictEqual(rulesList, [
      {
        rule: createdRule.rule,
        params: {
          ...defaultRule.params,
          ttl: 0,
        },
      },
    ]);
  });

  it('#list should list global rules', async () => {
    const rules = await this.dispatch(listAction, {});
    assert.strictEqual(rules.length, 1);
  });

  it('#list should list user rules', async () => {
    const rules = await this.dispatch(listAction, { username: 'some' });
    assert.strictEqual(rules.length, 1);
  });

  it('#list should return empty list', async () => {
    const rules = await this.dispatch(listAction, { username: 'someonewithoutrules' });
    assert.deepStrictEqual(rules, []);
  });
});
