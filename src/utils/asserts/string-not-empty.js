const { strictEqual } = require('assert');

// TODO
// module.exports = function stringNotEmpty(value) {
//   return typeof value === 'string' && value.length !== 0;
// };


module.exports = function assertStringNotEmpty(value, error) {
  strictEqual(typeof value === 'string', true, error);
  strictEqual(value.length !== 0, true, error);
};
