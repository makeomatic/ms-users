const jose = require('jose');

class JoseWrapper {
  constructor(config) {
    this.config = config;
  }

  async getKey() {
    if (this._key) {
      return this._key;
    }

    this._key = await jose.importJWK(this.config.jwk);

    return this._key;
  }

  async encrypt(payload) {
    const { cypher, jwk } = this.config;
    const key = await this.getKey();
    const encoder = new jose.EncryptJWT(payload);

    encoder.setProtectedHeader({
      ...cypher,
      kid: jwk.kid,
    });

    return encoder.encrypt(key);
  }

  async decrypt(data, params) {
    const key = await this.getKey();
    return jose.jwtDecrypt(data, key, params);
  }

  // eslint-disable-next-line class-methods-use-this
  async verify(token, params) {
    const key = await this.getKey();
    return jose.jwtVerify(token, key, params);
  }

  static isJweToken(token) {
    return token.split('.').length === 5;
  }
}

module.exports = { JoseWrapper };
