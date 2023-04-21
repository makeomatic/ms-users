const { decodeAndVerify } = require('../jwt');
const legacyJWT = require('../jwt-legacy');

class StreamLayerService {
  constructor(service, config) {
    this.service = service;
    this.config = config;

    this.audience = this.service.config.jwt.defaultAudience;
  }

  updateUserMeta(userId, extraUserId, account, userMeta = {}) {
    const params = {
      username: userId,
      audience: this.audience,
      metadata: { $set: { ...userMeta, [account]: { id: extraUserId } } },
    };

    return this.service.dispatch('updateMetadata', { params });
  }

  async authenticate(token, account) {
    const decodedToken = await decodeAndVerify(token);

    const { username, extra } = decodedToken;

    const meta = await this.updateUserMeta(username, extra.username, account);

    return legacyJWT.login(this, decodedToken.username, this.audience, meta);
  }
}

module.exports = StreamLayerService;
