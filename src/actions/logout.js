const jwt = require('../utils/jwt.js');

module.exports = function logout(opts) {
  const { jwt: token, audience } = opts;
  return jwt.logout.call(this, token, audience);
};
