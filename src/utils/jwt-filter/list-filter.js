const assert = require('assert');

const { RuleGroup } = require('./rule-group');

/**
 * Matches provided object to specific rule group
 */
class ListFilter {
  /**
   * @param {Logger} log
   */
  constructor(log) {
    assert(log, 'logger required');
    /** @type {RuleGroup[]} */
    this.ruleGroups = [];
  }

  /**
   * Match object using provided rules
   * @param {Object} obj
   * @returns {boolean}
   */
  match(obj, at = Date.now()) {
    for (const ruleGroup of this.ruleGroups) {
      if (ruleGroup.isActive(at) && ruleGroup.match(obj)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Add rules
   * @param {RuleGroup} ruleGroup
   * @returns {void}
   */
  add(ruleGroup) {
    assert(ruleGroup instanceof RuleGroup, 'RuleGroup is required');
    this.ruleGroups.push(ruleGroup);
  }

  /**
   * Add batch of rules
   * @param Object[] rulesList
   */
  addBatch(rulesList) {
    assert(Array.isArray(rulesList), 'must provide list of rules');

    rulesList.forEach(({ rule, params = {} }) => {
      const rg = RuleGroup.create(rule);
      rg.ttl = params.ttl;
      this.add(rg);
    });
  }
}

module.exports = {
  ListFilter,
};
