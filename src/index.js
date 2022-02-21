/**
 * Exports users service
 * @return {Users}
 */
module.exports = require('./users');

module.exports.auth = require('./auth/strategies');
module.exports.statelessJWT = require('./utils/stateless-jwt');
