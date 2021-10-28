const assert = require('assert');

const { RuleGroup } = require('./rule-group');
const { Rule } = require('./rule');

const MIN_PREFIX = 'list';

/**
 * Matches provided object to specific rule group
 */
class ListFilter {
  /**
   * @param {RadixStorage} storage - RadixStorage
   * @param {Logger} log
   */
  constructor(storage, log) {
    assert(storage, 'storage required');
    assert(log, 'logger required');
    this.rules = storage;
    this.minPrefix = MIN_PREFIX;
  }

  _getKey(key) {
    return `${this.minPrefix}:${key}`;
  }

  /**
   * Match object using specific key prefixes
   * @param {string|string[]} prefixes
   * @param {Object} obj
   * @returns {boolean}
   */
  match(prefixes, obj) {
    const prefixArr = Array.isArray(prefixes) ? prefixes : [prefixes];
    assert(typeof obj === 'object' && obj !== undefined, 'object required');

    const all = [];
    prefixArr.forEach((prefix) => {
      const rules = Array.from(
        this.rules.findGenerator(this._getKey(prefix))
      );
      all.push(...rules);
    });

    for (const rule of all) {
      if (rule[1].match(obj)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Add rules
   * @param {Rule|RuleGroup} rule
   * @returns {void}
   */
  add(key, rule) {
    assert(rule instanceof RuleGroup || rule instanceof Rule, 'Rule or RuleGroup required');
    assert(typeof key === 'string' && key.length > 0, 'key should be not empty string');
    this.rules.add(this._getKey(key), rule);
  }

  /**
   * Add batch of rules
   * @param {{ key: string, params: object }} rulesList
   */
  addBatch(rulesList) {
    assert(Array.isArray(rulesList), 'must provide list of rules');

    rulesList.forEach((rule) => {
      const { key, params } = rule;
      const rg = RuleGroup.create(params);
      this.add(key, rg);
    });
  }

  /**
   * Add raw rules
   * @param {{ key: string; param: string }[]} rulesList
   * @returns {void}
   */
  addRaw(rulesList) {
    assert(Array.isArray(rulesList), 'must provide list of rules');

    rulesList.forEach((rule) => {
      const { key, params } = rule;
      const parsed = JSON.parse(params);

      if (!parsed) {
        this.log.debug({ rule, parsed, err: 'unable to parse' });
        return;
      }

      const rg = RuleGroup.create(parsed);
      this.add(key, rg);
    });
  }
}

module.exports = {
  ListFilter,
};
