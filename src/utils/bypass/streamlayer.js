const { decodeAndVerify } = require('../jwt');
const legacyJWT = require('../jwt-legacy');

const { USERS_INVALID_TOKEN } = require('../../constants');

class StreamLayerService {
  constructor(service, config) {
    this.service = service;
    this.config = config;

    this.audience = this.service.config.jwt.defaultAudience;
  }

  async updateUserMeta(userId, extraUserId, account, userMeta = {}) {
    const params = {
      username: userId,
      audience: this.audience,
      metadata: { $set: { ...userMeta, [account]: { id: extraUserId } } },
    };

    await this.service.dispatch('updateMetadata', { params });

    delete params.metadata;

    return this.service.dispatch('getMetadata', { params });
  }

  async authenticate(token, account) {
    const decodedToken = await decodeAndVerify(this.service, token, this.audience);

    if (!decodedToken?.extra) throw USERS_INVALID_TOKEN;

    const { username, extra } = decodedToken;

    const metadata = await this.updateUserMeta(username, extra.username, account);

    const { jwt, userId } = await legacyJWT.login(this.service, decodedToken.username, this.audience, metadata);

    return {
      jwt,
      user: {
        id: userId,
        metadata,
      },
    };
  }
}

module.exports = StreamLayerService;
