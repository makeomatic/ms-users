const { strictEqual } = require('assert');

// TODO isInteger
// module.exports = function isInteger(value) {
//   return Number.isInteger(value);
// };

module.exports = function assertInteger(value, error) {
  strictEqual(Number.isInteger(value), true, error);
};
