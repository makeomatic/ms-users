const crypto = require('crypto');
const jose = require('jose');

class JWE {
  constructor(config) {
    this.config = config;
    this.key = JWE.loadKey(this.config.key);
  }

  async encode(payload) {
    const { cypher } = this.config;
    const encoder = new jose.EncryptJWT(payload);

    encoder.setProtectedHeader(cypher);

    return encoder.encrypt(this.key);
  }

  async decode(data, params) {
    return jose.jwtDecrypt(data, this.key, params);
  }

  // eslint-disable-next-line class-methods-use-this
  async verify(token, params) {
    return jose.jwtVerify(token, this.key, params);
  }

  static isJWEToken(token) {
    return token.split('.').length === 5;
  }

  static loadKey(keyConfig) {
    const { symetric, value } = keyConfig;

    if (symetric) {
      return crypto.createSecretKey(Buffer.from(value));
    }

    return crypto.createPrivateKey(value);
  }
}

module.exports = { JWE };
