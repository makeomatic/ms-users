const { assert } = require('chai');

const { ListFilter } = require('../../../../src/utils/radix-filter/list-filter');
const { Rule } = require('../../../../src/utils/radix-filter/rule');
const { RuleGroup } = require('../../../../src/utils/radix-filter/rule-group');
const { RadixStorage } = require('../../../../src/utils/radix-filter/storage');

describe('#radix-list filter', () => {
  let list = new ListFilter(true, true);

  beforeEach('start', () => {
    const storage = new RadixStorage();
    list = new ListFilter(storage, console);
  });

  it('requires storage and logger', () => {
    assert.throws(() => new ListFilter(), /storage required/);
    assert.throws(() => new ListFilter(true), /logger required/);
  });

  it('throws error on empty key', () => {
    assert.throws(
      () => list.add('', new Rule('foo', 'eq', 'dd')),
      /key should be/
    );
  });

  it('should be able to load data', () => {
    list.add('d', new Rule('foo', 'eq', 'dd'));
    list.add('b', new RuleGroup(list.rules));
    assert.strictEqual(list.rules.length(), 2);
  });

  it('should be able to load and parse rules', () => {
    list.addRaw([
      { key: 'g1', params: JSON.stringify({ aud: { eq: 'api' } }) },
      { key: 'g2', params: JSON.stringify({ aud: 'apd' }) },
      { key: 'g3',
        params: JSON.stringify({
          iss: 'ms-users',
          iat: { gt: 20 },
        }),
      },
      { key: 'g4',
        params: JSON.stringify({
          iss: 'ms-users',
          iat: { _or: true, gt: 20, eq: 100 },
        }),
      },
    ]);

    assert.strictEqual(list.rules.length(), 4);
  });

  it('should be able to load batch rules', () => {
    list.addBatch([
      { key: 'g1', params: { aud: { eq: 'api' } } },
      { key: 'g2', params: { aud: 'apd' } },
      { key: 'g3',
        params: {
          iss: 'ms-users',
          iat: { gt: 20 },
        },
      },
    ]);

    assert.strictEqual(list.rules.length(), 3);
  });

  describe('lookupchecks', () => {
    before(() => {
      list.addBatch([
        { key: 'gte', params: { fld: { gte: 10 } } },
        { key: 'lte', params: { fld: { lte: 10 } } },
        { key: 'both', params: { fld: { gte: 3, lte: 4 } } },
        { key: 'or-top', params: { _or: true, fld: 'bar', fld2: 'foo' } },
        { key: 'or-lower', params: { fld: { _or: true, gte: 3, lte: 7 } } },
        { key: 'strict', params: { fld: 'foo' } },
      ]);
    });

    const match = (keys, check, res = true) => {
      assert.strictEqual(list.match(keys, check), res);
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

    it('using empty aka global', () => {
      match('', { fld: 'foo' });
      match('', { fld: 10 });
    });
  });
});
