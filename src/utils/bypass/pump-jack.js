const got = require('got');
const assert = require('node:assert/strict');
const { Agent: HttpsAgent } = require('https');
const { HttpStatusError } = require('common-errors');
const { pick } = require('lodash');
const { USERS_INVALID_TOKEN, lockBypass, ErrorConflictUserExists } = require('../../constants');
const contacts = require('../contacts');

const schema = {
  $id: 'pump-jack.profile',
  type: 'object',
  required: ['phone', 'firstName', 'lastName'],
  properties: {
    firstName: {
      type: 'string',
    },
    lastName: {
      type: 'string',
    },
    phone: {
      type: 'string',
    },
  },
};

class PumpJackService {
  static get sharedFields() {
    return ['firstName', 'lastName', 'phone'];
  }

  static userId(userProfile) {
    return userProfile.phone.replace('+', '');
  }

  constructor(service) {
    this.service = service;
    this.req = got.extend({
      responseType: 'json',
      agent: {
        https: new HttpsAgent({
          keepAlive: true,
          maxFreeSockets: 32,
        }),
      },
    });
    this.registerUser = this.registerUser.bind(this);
    this.service.validator.ajv.addSchema(schema);
    this.audience = this.service.config.jwt.defaultAudience;
  }

  async authenticate(profileToken, { account }) {
    const userProfile = await this.retrieveUser(profileToken, account);
    return this.registerAndLogin(userProfile);
  }

  async registerAndLogin(userProfile) {
    // must be able to lock
    try {
      const registeredUser = await this.service.dlock.manager.fanout(
        lockBypass('pump-jack', PumpJackService.userId(userProfile)),
        5000,
        this.registerUser,
        userProfile
      );

      if (registeredUser) {
        await contacts.add.call(this.service, { contact: { type: 'phone', value: userProfile.phone }, userId: registeredUser.user.id });

        return registeredUser;
      }
    } catch (e) {
      this.service.log.error({ err: e }, 'pump-jack registration failed');
      throw new HttpStatusError(500, 'unable to validate user registration');
    }

    return this.login(userProfile);
  }

  async login(userProfile) {
    const params = {
      username: PumpJackService.userId(userProfile),
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
   * Registers "shadow" user in the microservice for future use
   * @param {UserProfile} userProfile - pump-jack profile
   */
  async registerUser(userProfile) {
    const params = {
      activate: true, // externally validated, no challenge
      username: PumpJackService.userId(userProfile),
      audience: this.audience,
      skipPassword: true,
      metadata: {
        ...pick(userProfile, PumpJackService.sharedFields),
      },
    };

    try {
      return await this.service.dispatch('register', { params });
    } catch (e) {
      // if user is already registered - that is fine, sign in
      // but if not - irrecoverable error
      if (e.code !== ErrorConflictUserExists.code) {
        this.service.log.error({ err: e }, 'failed to register pump-jack user');
        throw e;
      }
    }

    return false;
  }

  /**
   * Validates & retrieves pump-jack profile
   * @param {string} profileToken - pump-jack profile token
   */
  async retrieveUser(profileToken, account) {
    const accountCredentials = this.service.config.bypass.pumpJack.credentials[account];

    if (!accountCredentials) {
      throw new HttpStatusError(412, `unknown account: ${account}`);
    }

    const { apiKey, baseUrl } = accountCredentials;

    let response;

    try {
      const { body } = await this.req(`${baseUrl}${this.service.config.bypass.pumpJack.authUrl}`, {
        json: { profileToken },
        method: 'POST',
        headers: {
          'pjd-fanxp-integration-key': apiKey,
        },
      });

      assert(!body.hasError);

      response = body.data;
    } catch (e) {
      this.service.log.warn({ err: e }, 'failed to get user from pump-jack');
      throw USERS_INVALID_TOKEN;
    }

    // now that we've verified body - either create new user or register an old one
    try {
      return this.service.validator.ifError(schema.$id, response);
    } catch (e) {
      this.service.log.error({ err: e, profile: response }, 'pump-jack returned invalid profile');
      throw e;
    }
  }
}

module.exports = PumpJackService;
