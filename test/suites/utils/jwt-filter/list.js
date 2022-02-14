const { assert } = require('chai');

const { ListFilter } = require('../../../../src/utils/jwt-filter/list-filter');
const { Rule } = require('../../../../src/utils/jwt-filter/rule');
const { RuleGroup } = require('../../../../src/utils/jwt-filter/rule-group');

describe('#radix-list filter', () => {
  let list = new ListFilter(true);

  beforeEach('start', () => {
    list = new ListFilter(console);
  });

  it('requires logger', () => {
    assert.throws(() => new ListFilter(), /logger required/);
  });

  it('should be able to load data', () => {
    const rule = new Rule('foo', 'eq', 'dd');
    list.add(new RuleGroup(rule));
    assert.strictEqual(list.ruleGroups.length, 1);
  });

  it('should be able to load batch rules', () => {
    list.addBatch([
      { rule: { aud: { eq: 'api' } } },
      { rule: { aud: 'apd' } },
      {
        rule: {
          iss: 'ms-users',
          iat: { gt: 20 },
        },
      },
    ]);

    assert.strictEqual(list.ruleGroups.length, 3);
  });

  it('should skip outdated rules', () => {
    const filter = new ListFilter(console);
    const groupWithTTL = RuleGroup.create({
      fld: 10,
    });
    groupWithTTL.ttl = 200;
    filter.add(groupWithTTL);

    assert.strictEqual(filter.match({ fld: 10 }, 100), true);
    assert.strictEqual(filter.match({ fld: 10 }, 210), false);
  });

  describe('lookupchecks', () => {
    const rules = {
      gte: { rule: { fld: { gte: 10 } } },
      lte: { rule: { fld: { lte: 10 } } },
      both: { rule: { fld: { gte: 3, lte: 4 } } },
      'or-top': { rule: { _or: true, fld: 'bar', fld2: 'foo' } },
      'or-lower': { rule: { fld: { _or: true, gte: 3, lte: 7 } } },
      strict: { rule: { fld: 'foo' } },
      regex: { rule: { rfld: { regex: '^hello' } } },
      sw: { rule: { swfld: { sw: 'hello' } } },
    };

    const match = (keys, check, res = true) => {
      const tmpList = new ListFilter(console);
      tmpList.add(RuleGroup.create(rules[keys].rule));

      assert.strictEqual(tmpList.match(check), res);
    };

    it('handle gte, lte and group', () => {
      match('gte', { fld: 10 });
      match('gte', { fld: 11 });
      match('gte', { fld: 9 }, false);

      match('lte', { fld: 10 });
      match('lte', { fld: 20 }, false);

      match('both', { fld: 3 });
      match('both', { fld: 2 }, false);
    });

    it('handle or', () => {
      match('or-top', { fld: 'nop', fld2: 'foo' });
      match('or-lower', { fld: 5 });
      match('or-lower', { fld: 1 });
    });

    it('handle strict', () => {
      match('strict', { fld: 'foo' });
      match('strict', { fld: 'fo' }, false);
    });

    it('handle regex', () => {
      match('regex', { rfld: 'hello world' });
      match('regex', { rfld: 'bye world' }, false);
    });

    it('handle sw', () => {
      match('sw', { swfld: 'hello world' });
      match('sw', { swfld: 'bye world' }, false);
    });
  });
});
