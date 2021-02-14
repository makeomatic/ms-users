const got = require('got');
const assert = require('assert');
const { Agent: HttpsAgent } = require('https');
const { HttpStatusError } = require('common-errors');
const { pick } = require('lodash');
const { USERS_INVALID_TOKEN, lockBypass, ErrorConflictUserExists } = require('../../constants');
const contacts = require('../contacts');

const typeOrNull = (type, extra = {}) => ({
  anyOf: [{ type: 'null' }, { type, ...extra }],
});

const schema = {
  $id: 'pump-jack.profile',
  type: 'object',
  required: ['phone'],
  properties: {
    city: {
      type: 'string',
    },
    country: {
      type: 'string',
    },
    dob: {
      type: 'string', // timestamp
    },
    firstName: {
      type: 'string',
    },
    lastName: {
      type: 'string',
    },
    gender: typeOrNull('string'),
    state: {
      type: 'string',
    },
    zipCode: {
      type: 'string',
    },
    phone: {
      type: 'string',
    },
    email: {
      type: 'string',
    },
    creationStamp: {
      type: 'string',
    },
    hasAvatar: {
      type: 'boolean',
    },
    jerseyName: {
      type: 'string',
    },
    jerseyNumber: {
      type: 'string',
    },
    isSubscribedToTextAlerts: {
      type: 'boolean',
    },
    isNotificationEnabled: {
      type: 'boolean',
    },
    status: {
      type: 'number',
    },
    phoneCountry: typeOrNull('string'),
    nationality: {
      type: 'string',
    },
    residency: {
      type: 'string',
    },
    avatarUrl: {
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
      prefixUrl: this.service.config.bypass.pumpJack.baseUrl,
      responseType: 'json',
      agent: {
        https: new HttpsAgent({
          keepAlive: true,
          maxFreeSockets: 32,
        }),
      },
      headers: {
        'pjd-fanxp-integration-key': this.service.config.bypass.pumpJack.apiKey,
      },
    });
    this.registerUser = this.registerUser.bind(this);
    this.service.validator.ajv.addSchema(schema);
    this.audience = this.service.config.jwt.defaultAudience;
  }

  async authenticate(profileToken) {
    const userProfile = await this.retrieveUser(profileToken);
    return this.registerAndLogin(userProfile);
  }

  async registerAndLogin(userProfile) {
    // must be able to lock
    try {
      const registeredUser = await this.service.dlock.fanout(
        lockBypass('pump-jack', PumpJackService.userId(userProfile)),
        5000,
        this.registerUser,
        userProfile
      );

      if (registeredUser) {
        await contacts.add.call(this.servicecode, { contact: { type: 'phone', value: userProfile.phone }, userId: registeredUser.id });

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
  async retrieveUser(profileToken) {
    let response;

    try {
      const { body } = await got('/fanxp-integration/getUser', {
        json: { profileToken },
        method: 'POST',
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
