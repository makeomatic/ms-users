const oauthStrategy = require('./oauth');
const bearer = require('./strategy.bearer');

/**
 * Exports available auth strategies
 * @type {Object}
 */
module.exports = {
  bearer,
  oauth: oauthStrategy,
};
