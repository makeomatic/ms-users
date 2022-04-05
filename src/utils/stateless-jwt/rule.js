const assert = require('assert');
const ld = require('lodash');

class Rule {
  /**
   * Describes jeneric single field check rule
   * @param {string} field
   * @param {Function|Rule.queryOperators[item]} op
   * @param {any} value
   */
  constructor(field, op, value) {
    this.op = typeof op === 'function' ? op : Rule.queryOperators[op];
    assert(typeof this.op === 'function', `compare function is required: ${op}`);
    this.value = value;
    this.field = field;
  }

  match(data) {
    return this.op(ld.get(data, this.field), this.value);
  }
}

/**
 * Generic compare operations
 * Thanks to @vlatyshev
 */
Rule.queryOperators = {
  eq: (a, b) => a === b,
  ne: (a, b) => a !== b,
  gte: (a, b) => a >= b,
  lte: (a, b) => a <= b,
  gt: (a, b) => a > b,
  lt: (a, b) => a < b,
  regex: (a, b) => {
    if (typeof b !== 'string' && !(b instanceof RegExp)) {
      return true;
    }
    const valueAsRegEx = new RegExp(b);

    return valueAsRegEx.test(String(a));
  },
  sw: (a, b) => {
    if (typeof b !== 'string') {
      return true;
    }

    return String(a).startsWith(b);
  },
};

module.exports = {
  Rule,
};
