const assert = require('assert');
const { delay } = require('bluebird');
const { NotFoundError } = require('common-errors');

const updateAction = 'users.revoke-rule.update';
const getAction = 'users.revoke-rule.get';
const listAction = 'users.revoke-rule.list';
const deleteAction = 'users.revoke-rule.delete';

describe('#revoke-rule.* actions and RevocationRulesManager', () => {
  before('start', async () => {
    await global.startService.call(this, {
      revocationRulesManager: {
        enabled: true,
        jobsEnabled: false,
      },
    });

    await this.users.revocationRulesManager.batchDelete(['']);
  });

  after('stop', async () => {
    await global.clearRedis.call(this, false);
  });

  it('schema validation', async () => {
    await assert.rejects(this.dispatch(deleteAction, {}), /data should have required property 'rule'/);
    await assert.rejects(this.dispatch(updateAction, {}), /data should have required property 'rule'/);
    await assert.rejects(this.dispatch(getAction, {}), /data should have required property 'rule'/);
    await assert.rejects(this.dispatch(updateAction, { rule: {} }), /data.rule should have required property 'params'/);

    await assert.rejects(
      this.dispatch(updateAction, {
        rule: {
          params: {
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
      this.dispatch(updateAction, {
        rule: {
          params: {
            otherFld: {
              eq: {}, // valid op, but no object match for now
            },
          },
        },
      }),
      // eslint-disable-next-line max-len
      /data.rule.params\['otherFld'\].eq should be string, data.rule.params\['otherFld'\] should be string, data.rule.params\['otherFld'\] should be number, data.rule.params\['otherFld'\] should be boolean, data.rule.params\['otherFld'\] should match some schema in anyOf/
    );
  });

  it('#update should create/update global rule', async () => {
    const defaultRule = { params: { iss: 'ms-users' } };
    const createdRule = await this.dispatch(updateAction, { rule: defaultRule });
    const fromConsul = await this.dispatch(getAction, { rule: createdRule.rule });

    assert.deepStrictEqual(fromConsul, {
      rule: createdRule.rule,
      params: {
        ...defaultRule.params,
        ttl: 0,
      },
    });

    const updatedRule = await this.dispatch(updateAction, {
      rule: {
        id: createdRule.rule,
        params: {
          ...defaultRule.params,
          iat: { lte: 1212 },
        },
      },
    });
    const updatedFromConsul = await this.dispatch(getAction, { rule: updatedRule.rule });

    assert.deepStrictEqual(updatedFromConsul, {
      rule: createdRule.rule,
      params: {
        ...defaultRule.params,
        iat: { lte: 1212 },
        ttl: 0,
      },
    });
  });

  it('#update should create/update user rule', async () => {
    const defaultRule = { params: { iss: 'ms-users-test' } };
    const createdRule = await this.dispatch(updateAction, { username: 'some', rule: defaultRule });
    const fromConsul = await this.dispatch(getAction, { username: 'some', rule: createdRule.rule });

    assert.deepStrictEqual(fromConsul, {
      rule: createdRule.rule,
      params: {
        ...defaultRule.params,
        ttl: 0,
      },
    });

    const ttl = 60 * 60 * 1000;
    const updatedRule = await this.dispatch(updateAction, {
      username: 'some',
      rule: {
        id: createdRule.rule,
        params: {
          ...defaultRule.params,
          iat: { lte: 1212 },
          ttl,
        },
      },
    });
    const updatedFromConsul = await this.dispatch(getAction, { username: 'some', rule: updatedRule.rule });

    assert.deepStrictEqual(updatedFromConsul, {
      rule: createdRule.rule,
      params: {
        ...defaultRule.params,
        iat: { lte: 1212 },
        ttl,
      },
    });
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

  it('#delete should delete rules', async () => {
    const rules = await this.dispatch(listAction, {});

    await this.dispatch(deleteAction, { rule: rules[0].rule });
    const rulesAfterDelete = await this.dispatch(listAction, {});

    assert.deepStrictEqual(rulesAfterDelete.length, 0);
  });

  it('#delete should delete user rules', async () => {
    const userRules = await this.dispatch(listAction, { username: 'some' });

    await this.dispatch(deleteAction, { rule: userRules[0].rule, username: 'some' });
    const userRulesAfterDelete = await this.dispatch(listAction, { username: 'some' });

    assert.deepStrictEqual(userRulesAfterDelete.length, 0);
  });

  it('#get should throw 404', async () => {
    await assert.rejects(
      this.dispatch(getAction, { rule: 'doesnotexists' }),
      /rule: doesnotexists: g\/doesnotexists/
    );

    await assert.rejects(
      this.dispatch(getAction, { username: 'nobody', rule: 'doesnotexists' }),
      /rule: doesnotexists: u\/nobody\/doesnotexists/
    );
  });

  it('#delete should throw rule not found', async () => {
    await assert.rejects(
      this.dispatch(deleteAction, { rule: 'doesnotexists' }),
      /rule: doesnotexists: g\/doesnotexists/
    );

    await assert.rejects(
      this.dispatch(deleteAction, { username: 'nobody', rule: 'doesnotexists' }),
      /rule: doesnotexists: u\/nobody\/doesnotexists/
    );
  });
});

describe('ttl cleanup', () => {
  before('start', async () => {
    await global.startService.call(this, {
      revocationRulesManager: {
        enabled: true,
        jobsEnabled: true,
        cleanupInterval: 2000,
      },
    });

    await this.users.revocationRulesManager.batchDelete(['']);
  });

  after('stop', async () => {
    await global.clearRedis.call(this, false);
  });

  it('should perform cleanup', async () => {
    const createdRule = await this.dispatch(updateAction, {
      username: 'some',
      rule: {
        params: {
          iat: { lte: 1212 },
          ttl: Date.now() - 10000,
        },
      },
    });

    const waitDelete = async () => {
      try {
        const rule = await this.dispatch(getAction, { username: 'some', rule: createdRule.rule });
        if (rule) {
          await delay(200);
          return waitDelete();
        }
      } catch (e) {
        if (e instanceof NotFoundError) {
          return true;
        }
      }
      return false;
    };

    const waitResult = await waitDelete();

    assert.strictEqual(waitResult, true);
  });
});
