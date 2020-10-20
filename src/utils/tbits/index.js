const got = require('got');
const assert = require('assert');
const camelcase = require('camelcase');
const { Agent: HttpsAgent } = require('https');
const { HttpStatusError } = require('common-errors');
const { pick } = require('lodash');
const { USERS_INVALID_TOKEN, lockTbits, ErrorConflictUserExists } = require('../../constants');
const contacts = require('../contacts');

const toCamelCase = (obj) => {
  const response = Object.create(null);
  for (const [key, value] of Object.entries(obj)) {
    response[camelcase(key)] = value;
  }
  return response;
};

const typeOrNull = (type, extra = {}) => ({
  anyOf: [{ type: 'null' }, { type, ...extra }],
});

const schema = {
  $id: 'tbits.fan-profile',
  type: 'object',
  required: ['accountId', 'fanId'],
  properties: {
    fanId: {
      type: 'number',
    },
    accountId: {
      type: 'number',
    },
    firstName: {
      type: 'string',
    },
    lastName: {
      type: 'string',
    },
    name: {
      type: 'string',
    },
    email: {
      type: 'string',
      format: 'email',
    },
    province: {
      type: 'string',
    },
    latitude: {
      type: 'number',
    },
    longitude: {
      type: 'number',
    },
    login_name: {
      type: 'string',
    },
    creationTimestamp: {
      type: 'integer',
    },
    ipAddress: {
      type: 'string',
    },
    countryCode: {
      type: 'string',
    },
    city: {
      type: 'string',
    },
    isSubscribed: {
      type: 'boolean',
    },
    rating: typeOrNull('number'),
    phone: typeOrNull('string'),
    birthDate: typeOrNull('string', {
      description: 'optional ?? returned as null',
    }),
    metroArea: typeOrNull('string'),
    postalCode: typeOrNull('string'),
    fields: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
    imageUrl: typeOrNull('string'),
    gender: typeOrNull('string', {
      enum: ['male', 'female'],
    }),
    tags: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
    resetUid: typeOrNull('string', {
      description: 'optional ?? returned as null - not sure what it means/used as',
    }),
  },
};

class TbitsService {
  static get sharedFields() {
    return ['firstName', 'lastName', 'fanId', 'accountId'];
  }

  static userId(userProfile) {
    return `tbits/${userProfile.accountId}/${userProfile.fanId}`;
  }

  constructor(service) {
    this.service = service;
    this.req = got.extend({
      prefixUrl: 'https://tradablebits.com/api/v1',
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

  async authenticate(sessionUid) {
    const userProfile = await this.retrieveUser(sessionUid);
    return this.registerAndLogin(userProfile);
  }

  async registerAndLogin(userProfile) {
    // must be able to lock
    try {
      const registeredUser = await this.service.dlock.fanout(lockTbits(userProfile), 5000, this.registerUser, userProfile);
      if (registeredUser) {
        if (userProfile.phone) {
          await contacts.add.call(this, { contact: { type: 'phone', value: userProfile.phone }, userId: registeredUser.id });
        }

        return registeredUser;
      }
    } catch (e) {
      this.service.log.error({ err: e }, 'tbits registration failed');
      throw new HttpStatusError(500, 'unable to validate user registration');
    }

    return this.login(userProfile);
  }

  async login(userProfile) {
    const params = {
      username: TbitsService.userId(userProfile),
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
   * @param {UserProfile} userProfile - tbits fan xp profile
   */
  async registerUser(userProfile) {
    const params = {
      activate: true, // externally validated, no challenge
      username: TbitsService.userId(userProfile),
      audience: this.audience,
      skipPassword: true,
      metadata: {
        ...pick(userProfile, TbitsService.sharedFields),
      },
    };

    try {
      return await this.service.dispatch('register', { params });
    } catch (e) {
      // if user is already registered - that is fine, sign in
      // but if not - irrecoverable error
      if (e.code !== ErrorConflictUserExists.code) {
        this.service.log.error({ err: e }, 'failed to register tbits user');
        throw e;
      }
    }

    return false;
  }

  /**
   * Validates & retrieves tbits fan profile, as well as transforms it into camel case
   * @param {string} sessionUid - tbits authentication token
   */
  async retrieveUser(sessionUid) {
    const { apiKey } = this.service.config.tbits;
    let response;

    try {
      const searchParams = { api_key: apiKey };
      const { statusCode, body } = await this.req(`sessions/${sessionUid}/fan`, { searchParams });

      assert.equal(statusCode, 200);

      response = body;
    } catch (e) {
      this.service.log.warn({ err: e }, 'failed to verify session uid');
      throw USERS_INVALID_TOKEN;
    }

    // now that we've verified body sessionUid - either create new user or register an old one
    try {
      return this.service.validator.ifError(schema.$id, toCamelCase(response));
    } catch (e) {
      this.service.log.error({ err: e, profile: toCamelCase(response) }, 'tbits returned invalid profile');
      throw e;
    }
  }
}

module.exports = TbitsService;
