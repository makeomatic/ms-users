const { decodeAndVerify } = require('../jwt');
const { ErrorUserNotFound, ErrorOrganizationNotFound } = require('../../constants');

class GenericBypassService {
  constructor(service, config) {
    this.service = service;
    this.config = config;
    this.audience = this.service.config.jwt.defaultAudience;
    this.bypassProvider = this.config.provider;

    this.log = this.service.log.child({ bypass: this.bypassProvider });
  }

  static userPrefix(organizationId, userId) {
    return `g/${organizationId}-${userId}`;
  }

  async login(organizationId, userId) {
    const params = {
      username: GenericBypassService.userPrefix(organizationId, userId),
      audience: this.audience,
      isSSO: true,
    };

    return this.service.dispatch('login', { params });
  }

  async registerUser(userId, userName, organizationId) {
    this.log.debug({ userId, userName, bypassProvider: this.bypassProvider }, 'registring user');

    const params = {
      activate: true,
      skipPassword: true,
      username: GenericBypassService.userPrefix(organizationId, userId),
      audience: this.audience,
      metadata: {
        name: userName,
        organizationId,
      },
    };

    try {
      const user = await this.service.dispatch('register', { params });

      return user;
    } catch (err) {
      this.log.error({ err, bypassProvider: this.bypassProvider }, 'failed to register user');

      throw err;
    }
  }

  async signIn(userId, userName, organizationId) {
    this.log.debug({ userId, userName, bypassProvider: this.bypassProvider }, 'trying to sign in');

    try {
      const login = await this.login(organizationId, userId);

      return login;
    } catch (err) {
      if (err !== ErrorUserNotFound) {
        this.log.error({ err, bypassProvider: this.bypassProvider }, 'failed to login');

        throw err;
      }
    }

    return this.registerUser(userId, userName, organizationId);
  }

  async verify(token, organizationId) {
    const { extra, username } = await decodeAndVerify(this.service, token, this.audience);

    if (extra?.organizationId !== organizationId) {
      throw ErrorOrganizationNotFound;
    }

    const params = { username, audience: this.audience };
    const metadata = await this.service.dispatch('getMetadata', { params });

    return {
      jwt: token,
      user: {
        id: username,
        metadata,
      },
    };
  }

  /**
   * Generic bypass
   *  - signIn User and return JWT
   *  - verify JWT
   *  userKey: userId or JWT
   * @param {*} userKey
   * @param {*} { account: userName, organizationId, init }
   * @returns
   */
  async authenticate(userKey, { account, organizationId, init }) {
    if (!organizationId) {
      throw ErrorOrganizationNotFound;
    }

    return init
      ? this.signIn(userKey, account, organizationId)
      : this.verify(userKey, organizationId);
  }
}

module.exports = GenericBypassService;
