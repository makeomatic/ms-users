const { strictEqual } = require('assert');

module.exports = function notEmptyStringOrArray(value, error) {
  strictEqual((typeof value === 'string' && value.length !== 0) || Array.isArray(value), true, error);
};
