const { HttpStatusError } = require('common-errors');
const { pick } = require('lodash');
const undici = require('undici');

const { USERS_INVALID_TOKEN, lockBypass, ErrorConflictUserExists } = require('../../constants');
const contacts = require('../contacts');

const AJV_SCHEME_ID = 'masters.profile';

const schema = {
  $id: AJV_SCHEME_ID,
  type: 'object',
  required: ['userId', 'firstName', 'lastName', 'email'],
  properties: {
    userId: {
      type: 'string',
      format: 'uuid',
    },
    firstName: {
      type: 'string',
    },
    lastName: {
      type: 'string',
    },
    email: {
      type: 'string',
      format: 'email',
    },
  },
};

class MastersService {
  static get sharedFields() {
    return ['firstName', 'lastName', 'email'];
  }

  constructor(service, config) {
    this.service = service;
    this.config = config;

    this.httpPool = new undici.Pool(this.config.baseUrl, {
      connections: 1,
      pipelining: 1,
      ...this.config.httpPoolOptions,
    });

    this.registerUser = this.registerUser.bind(this);
    if (!this.service.validator.ajv._schemas[AJV_SCHEME_ID]) {
      this.service.validator.ajv.addSchema(schema);
    }
    this.audience = this.service.config.jwt.defaultAudience;
  }

  static userId(userProfile) {
    return userProfile.userId;
  }

  async login(userProfile) {
    const params = {
      username: MastersService.userId(userProfile),
      audience: this.audience,
      isSSO: true,
    };

    try {
      return await this.service.dispatch('login', { params });
    } catch (e) {
      this.service.log.error({ err: e }, 'failed to login');
      throw USERS_INVALID_TOKEN;
    }
  }

  /**
   * register user
   * @param {object} userProfile
   * @returns {Promise<{status: boolean, data?: object}>}
   */
  async registerUser(userProfile) {
    const params = {
      activate: true, // externally validated, no challenge
      username: MastersService.userId(userProfile),
      audience: this.audience,
      skipPassword: true,
      metadata: {
        ...pick(userProfile, MastersService.sharedFields),
        masters: {
          id: userProfile.userId,
        },
      },
    };

    try {
      const userData = await this.service.dispatch('register', { params });
      return { status: true, data: userData };
    } catch (e) {
      // normal situation: user already exists
      if (e.code === ErrorConflictUserExists.code) {
        return { status: false };
      }
      this.service.log.error({ err: e }, 'failed to register masters user');
      throw e;
    }
  }

  async registerAndLogin(userProfile) {
    // must be able to lock
    try {
      const { status, data } = await this.service.dlock.fanout(
        lockBypass('masters', MastersService.userId(userProfile)),
        5000,
        this.registerUser,
        userProfile
      );

      if (status) {
        await contacts.add.call(this.service, {
          contact: { type: 'email', value: userProfile.email },
          userId: data.user.id,
        });
        return data;
      }
    } catch (e) {
      this.service.log.error({ err: e }, 'masters registration failed');
      throw new HttpStatusError(500, 'unable to validate user registration');
    }

    return this.login(userProfile);
  }

  async retrieveUser(profileToken, account) {
    const accountCredentials = this.config.credentials[account];
    if (!accountCredentials) throw new HttpStatusError(412, `unknown account: ${account}`);

    let response;

    try {
      const { body } = await this.httpPool.request({
        headersTimeout: 5000,
        bodyTimeout: 5000,
        ...this.config.httpClientOptions,
        path: `${this.config.authPath}?token=${profileToken}`,
        method: 'GET',
      });
      response = await body.json();
    } catch (e) {
      this.service.log.warn({ err: e }, 'failed to get user from masters');
      throw USERS_INVALID_TOKEN;
    }

    // now that we've verified body - either create new user or register an old one
    try {
      return this.service.validator.ifError(schema.$id, response);
    } catch (e) {
      this.service.log.error({ err: e, profile: response }, 'masters returned invalid profile');
      throw e;
    }
  }

  async authenticate(profileToken, account) {
    const userProfile = await this.retrieveUser(profileToken, account);
    return this.registerAndLogin(userProfile);
  }
}

module.exports = MastersService;
