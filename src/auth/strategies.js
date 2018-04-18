const oauthStrategy = require('./oauth');
const bearer = require('./strategy.bearer');
const httpBearer = require('./strategy.http-bearer');

/**
 * Exports available auth strategies
 * @type {Object}
 */
module.exports = {
  bearer,
  httpBearer,
  oauth: oauthStrategy,
};
