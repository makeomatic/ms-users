const oauthStrategy = require('./oauth');

/**
 * Exports available auth strategies
 * @type {Object}
 */
module.exports = {
  oauth: oauthStrategy,
};
