const got = require('got');
const { Agent: HttpsAgent } = require('https');
const { HttpStatusError } = require('common-errors');
const { pick } = require('lodash');
const { USERS_INVALID_TOKEN, lockBypass, ErrorConflictUserExists } = require('../../constants');
const contacts = require('../contacts');

const schema = {
  $id: 'masters.profile',
  type: 'object',
  required: ['firstName', 'lastName', 'email'],
  properties: {
    firstName: {
      type: 'string',
    },
    lastName: {
      type: 'string',
    },
    email: {
      type: 'string',
    },
  },
};

class MastersService {
  static get sharedFields() {
    return ['firstName', 'lastName', 'email'];
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
      headers: {
        'User-Agent': 'got',
      },
    });
    this.registerUser = this.registerUser.bind(this);
    this.service.validator.ajv.addSchema(schema);
    this.audience = this.service.config.jwt.defaultAudience;
  }

  static userId(userProfile) {
    return userProfile.email;
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
      return await this.service.dispatch('register', { params });
    } catch (e) {
      // if user is already registered - that is fine, sign in
      // but if not - irrecoverable error
      if (e.code !== ErrorConflictUserExists.code) {
        this.service.log.error({ err: e }, 'failed to register masters user');
        throw e;
      }
    }

    return false;
  }

  async registerAndLogin(userProfile) {
    // must be able to lock
    try {
      const registeredUser = await this.service.dlock.fanout(
        lockBypass('masters', MastersService.userId(userProfile)),
        5000,
        this.registerUser,
        userProfile
      );

      if (registeredUser) {
        await contacts.add.call(this.service, {
          contact: { type: 'email', value: userProfile.email },
          userId: registeredUser.id,
        });

        return registeredUser;
      }
    } catch (e) {
      this.service.log.error({ err: e }, 'masters registration failed');
      throw new HttpStatusError(500, 'unable to validate user registration');
    }

    return this.login(userProfile);
  }

  async retrieveUser(profileToken, account) {
    const config = this.service.config.bypass.masters;

    const accountCredentials = config.credentials[account];

    if (!accountCredentials) throw new HttpStatusError(412, `unknown account: ${account}`);

    const { baseUrl } = accountCredentials;

    let response;

    try {
      const { body } = await this.req(`${baseUrl}${config.authUrl}?token=${profileToken}`, {
        method: 'GET',
      });

      response = body;
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
