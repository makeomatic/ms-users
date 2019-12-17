const { strictEqual } = require('assert');

module.exports = function assertStringNotEmpty(value, error) {
  strictEqual(typeof value === 'string', true, error);
  strictEqual(value.length !== 0, true, error);
};
