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

    this.log.debug({ userId, userName, bypassProvider: this.bypassProvider }, 'user not exists. Registring user');

    return this.registerUser(userId, userName, organizationId);
  }

  /**
   * Generic bypass
   *  - sign User by userId and userName (account) and return JWT
   *  - register User if not exists OR login
   *  userId should be authenticated outside of ms-users
   * @param {*} userId
   * @param {*} { account: userName, organizationId }
   * @returns
   */
  async authenticate(userId, { account, organizationId }) {
    if (!organizationId) {
      throw ErrorOrganizationNotFound;
    }

    const user = await this.signIn(userId, account, organizationId);

    return user;
  }
}

module.exports = GenericBypassService;
