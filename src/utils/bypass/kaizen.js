const { ErrorUserNotFound } = require('../../constants');

class KaizenService {
  constructor(service, config) {
    this.service = service;
    this.config = config;
    this.audience = this.service.config.jwt.defaultAudience;
    this.bypassProvider = this.config.provider;

    this.log = this.service.log.child({ bypass: this.bypassProvider });
  }

  static userId(userId) {
    return `kaizen/${userId}`;
  }

  async login(userId) {
    const params = {
      username: KaizenService.userId(userId),
      audience: this.audience,
      isSSO: true,
    };

    return this.service.dispatch('login', { params });
  }

  async registerUser(userId, userName) {
    const params = {
      activate: true,
      skipPassword: true,
      username: KaizenService.userId(userId),
      audience: this.audience,
      metadata: {
        name: userName,
      },
    };

    try {
      const user = await this.service.dispatch('register', { params });

      return user;
    } catch (err) {
      this.log.error({ err }, 'failed to register user');

      throw err;
    }
  }

  async signIn(userId, userName) {
    this.log.debug({ userId, userName }, 'trying to sign in');

    try {
      const login = await this.login(userId);

      return login;
    } catch (err) {
      if (err !== ErrorUserNotFound) {
        this.log.error({ err }, 'failed to login');

        throw err;
      }
    }

    this.log.debug({ userId, userName }, 'user not exists. Registring user');

    return this.registerUser(userId, userName);
  }

  /**
   *
   * @param {*} userId
   * @param {*} { account } userName
   * @returns
   */
  async authenticate(userId, { account }) {
    const user = await this.signIn(userId, account);

    return user;
  }
}

module.exports = KaizenService;
