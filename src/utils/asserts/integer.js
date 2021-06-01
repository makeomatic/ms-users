const { strictEqual } = require('assert');

module.exports = function assertInteger(value, error) {
  strictEqual(Number.isInteger(value), true, error);
};
