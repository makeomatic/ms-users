const hmac = require('jwa')('HS256');

exports.sign = function sign(payload) {
  return hmac.sign(payload, this.config.accessTokens.secret);
};

exports.verify = function verify(payload, signature) {
  return hmac.verify(payload, signature, this.config.accessTokens.secret);
};
