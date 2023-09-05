const { HttpStatusError } = require('@microfleet/validation');
const { ErrorUserNotFound, ErrorOrganizationNotFound } = require('../../constants');

class GenericBypassService {
  constructor(service, config) {
    this.service = service;
    this.config = config;

    /**
     * @type {string}
     */
    this.audience = this.service.config.jwt.defaultAudience;

    /**
     * @type {string[]}
     */
    this.subaccounts = config.subaccounts;

    this.log = this.service.log.child({ bypass: 'generic' });
  }

  static userPrefix(organizationId, userId) {
    return `g/${organizationId}-${userId}`;
  }

  async #login(organizationId, userId) {
    const params = {
      username: GenericBypassService.userPrefix(organizationId, userId),
      audience: this.audience,
      isSSO: true,
    };

    return this.service.dispatch('login', { params });
  }

  /**
   *
   * @param {string} userId
   * @param {Record<string, any>} profile
   * @param {string} organizationId
   */
  async #registerUser(userId, profile, organizationId) {
    this.log.debug({ userId, profile }, 'registering user');

    const params = {
      activate: true,
      skipPassword: true,
      username: GenericBypassService.userPrefix(organizationId, userId),
      audience: this.audience,
      metadata: {
        ...profile,
        organizationId,
      },
    };

    try {
      return await this.service.dispatch('register', { params });
    } catch (err) {
      this.log.error({ err }, 'failed to register user');
      throw err;
    }
  }

  async #updateUserMeta(userId, userMeta, profile = {}) {
    const params = {
      username: userId,
      audience: this.audience,
      metadata: { $set: { ...userMeta, ...profile } },
    };

    return this.service.dispatch('updateMetadata', { params });
  }

  /**
   *
   * @param {string} userId - external user id
   * @param {Record<string, any>} profile - optional user profile
   * @param {string} organizationId - organization id user is associated with
   * @returns
   */
  async #loginOrRegister(userId, organizationId, profile = {}) {
    this.log.debug({ userId, profile }, 'trying to login');

    let loginResponse;

    try {
      loginResponse = await this.#login(organizationId, userId);
      const userMeta = loginResponse.user.metadata[this.audience];

      const propsToUpdate = [];
      const newProps = Object.keys(profile);

      for (const prop of newProps) {
        if (!userMeta[prop] || userMeta[prop] !== profile[prop]) {
          propsToUpdate.push(prop);
        }
      }

      if (propsToUpdate.length === 0) {
        return loginResponse;
      }

      await this.#updateUserMeta(loginResponse.user.id, userMeta, profile);

      loginResponse.user.metadata[this.audience] = { ...userMeta, ...profile };

      return loginResponse;
    } catch (err) {
      if (err !== ErrorUserNotFound) {
        this.log.error({ err }, 'failed to login');
        throw err;
      }

      return this.#registerUser(userId, profile, organizationId);
    }
  }

  /**
   *
   * @param {string} token - jwt token to be verified
   * @param {string} organizationId - associated org id
   * @returns {Promise<>} user profile & same token to be used further
   */
  async #verify(token, organizationId) {
    // internal verify dispatch - to keep logic the same across the service
    const user = await this.service.dispatch('verify', {
      params: {
        token,
        audience: this.audience,
      },
    });

    // ensure organization id is encoded and is the same
    // same logic must be present later in the verify endpoint
    if (user.extra.organizationId !== organizationId) {
      throw ErrorOrganizationNotFound;
    }

    return { jwt: token, user };
  }

  /**
   * Generic bypass
   *  - signIn User and return JWT
   *  - verify JWT
   *  userKey: userId or JWT
   * @param {string} tokenOrUsedId - signed JWT token or external user id when `init` is `true`
   * @param {object} data
   * @param {string} data.account - client account name, used to verify for ability to use this feature
   * @param {Record<string, any>} [data.profile] - associated user profile
   * @param {string} data.organizationId - associated org id
   * @param {boolean} data.init - true when we need to create JWT or verify it
   * @returns {Promise<{ jwt: string, user: { id: string, metadata: Record<string, Record<string, any>> }}>}
   */
  async authenticate(tokenOrUsedId, { account, profile, organizationId, init }) {
    if (!this.subaccounts.includes(account)) {
      throw new HttpStatusError(400, `${account} does not support generic auth`);
    }

    if (!organizationId) {
      throw ErrorOrganizationNotFound;
    }

    return init
      ? this.#loginOrRegister(tokenOrUsedId, organizationId, profile)
      : this.#verify(tokenOrUsedId, organizationId);
  }
}

module.exports = GenericBypassService;
