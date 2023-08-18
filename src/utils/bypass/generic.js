const { ErrorOrganizationNotFound } = require('../../constants');

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
    this.log.debug({ userId, bypassProvider: this.bypassProvider }, 'trying to sign in');

    const params = {
      username: GenericBypassService.userPrefix(organizationId, userId),
      audience: this.audience,
      isSSO: true,
    };

    const login = await this.service.dispatch('login', { params });

    const userMeta = login.user.metadata[this.audience];

    if (userMeta?.organizationId !== organizationId) {
      throw ErrorOrganizationNotFound;
    }

    return login;
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

  /**
   * Generic bypass
   *  - register User if init:true OR login
   *  - return JWT
   *  userId should be authenticated outside of ms-users
   * @param {*} userId
   * @param {*} { account: userName, organizationId, init }
   * @returns
   */
  async authenticate(userId, { account, organizationId, init }) {
    if (!organizationId) {
      throw ErrorOrganizationNotFound;
    }

    return init
      ? this.registerUser(userId, account, organizationId)
      : this.login(organizationId, userId);
  }
}

module.exports = GenericBypassService;
