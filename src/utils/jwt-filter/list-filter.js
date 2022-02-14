const assert = require('assert');

const { RuleGroup } = require('./rule-group');
const { Rule } = require('./rule');

/**
 * Matches provided object to specific rule group
 */
class ListFilter {
  /**
   * @param {Logger} log
   */
  constructor(log) {
    assert(log, 'logger required');
    this.rules = [];
  }

  /**
   * Match object using specific key prefixes
   * @param {string|string[]} prefixes
   * @param {Object} obj
   * @returns {boolean}
   */
  match(obj) {
    for (const rule of this.rules) {
      if (rule.match(obj)) {
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
  add(rule) {
    assert(rule instanceof RuleGroup || rule instanceof Rule, 'Rule or RuleGroup required');
    this.rules.push(rule);
  }

  /**
   * Add batch of rules
   * @param Object[] rulesList
   */
  addBatch(rulesList) {
    assert(Array.isArray(rulesList), 'must provide list of rules');

    rulesList.forEach(({ rule }) => {
      const rg = RuleGroup.create(rule);
      this.add(rg);
    });
  }
}

module.exports = {
  ListFilter,
};
