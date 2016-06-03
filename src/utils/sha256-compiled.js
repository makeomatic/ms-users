'use strict';

const crypto = require('crypto');

/**
 * Shorthand for sha256
 * @param  {String} data
 */
module.exports = function digest(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest();
};

//# sourceMappingURL=sha256-compiled.js.map