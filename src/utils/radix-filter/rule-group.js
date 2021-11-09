const assert = require('assert');

const { Rule } = require('./rule');

/**
 * Combines multiple rules into one group
 */
class RuleGroup {
  /**
   * @param {Rule[]} rules
   * @param {boolean} isOr - true if it's an `or` check, otherwise `and`
   */
  constructor(rules = [], isOr = false) {
    this.isOr = isOr;
    this.rules = Array.isArray(rules) ? rules : [];
  }

  /**
   * Add rules
   * @param {Rule|Rule[]} rules
   * @returns {void}
   */
  add(rules) {
    const rulesToAdd = Array.isArray(rules) ? rules : [rules];
    rulesToAdd.forEach((rule) => this.rules.push(rule));
  }

  /**
   * Matches provided object
   * @param {Object} data
   * @returns {boolean}
   */
  match(data) {
    assert(data != null && typeof data === 'object', 'data should be object');

    for (const rule of this.rules) {
      const result = rule.match(data);

      if (this.isOr && result) {
        return true;
      }

      if (!this.isOr && !result) {
        return false;
      }
    }

    return true;
  }
}

/**
 * Creates RuleGroup from predefined object
 * @param {Object} ruleSpec Object
 * @param {string} key
 * @param {boolean} isOr
 * @returns {RuleGroup}
 * @example
 *  const rg = RuleGroup.create({
      _or: true,
      iss: 'ms-users',
      iat: { _or: true, gt: 20, eq: 100 },
    })
 */
RuleGroup.create = function createRecursive(ruleSpec, key = '') {
  const { _or, ...rest } = ruleSpec;

  const rules = Object.entries(rest).map(([k, spec]) => {
    if (spec != null && typeof spec === 'object') {
      return RuleGroup.create(spec, k);
    }

    if (key === '') {
      return new Rule(k, Rule.queryOperators.eq, spec);
    }

    return new Rule(key, k, spec);
  });

  if (rules.length === 1 && rules[0] instanceof RuleGroup) {
    return rules[0];
  }

  return new RuleGroup(rules, _or);
};

module.exports = {
  RuleGroup,
};
