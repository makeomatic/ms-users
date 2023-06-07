const assert = require('node:assert/strict');
const { StringDecoder } = require('node:string_decoder');
const { HttpStatusError } = require('common-errors');
const { customAlphabet } = require('nanoid');
const { faker: { word } } = require('@faker-js/faker');
const jose = require('jose');
const sjson = require('secure-json-parse');
const { decode } = require('z32');
const { Authenticator } = require('@otplib/core');
const { createDigest, createRandomBytes } = require('@otplib/plugin-crypto'); // use your chosen crypto plugin

const AJV_SCHEME_ID = '@bypass.slra.userId';

// Setup an OTP instance which we need
const stringDecoder = new StringDecoder('utf8');
const authenticator = new Authenticator({
  createDigest,
  createRandomBytes,
  keyDecoder(secret, encoding) {
    return decode(secret).toString(encoding);
  },
});

const { USERS_INVALID_TOKEN, lockBypass, ErrorConflictUserExists, ErrorUserNotFound } = require('../../constants');

const userIdGenerator = customAlphabet('123456789', 6);

class StreamlayerAnonymousService {
  /**
   * @typedef { import('@microfleet/core').Microfleet } Microfleet
   *
   * @typedef {Object} Configuration
   * @property {boolean} enabled
   * @property {string} provider
   * @property {string} audience
   * @property {string} totpKey
   * @property {string} pkKey
   * @property {string} idField
   */

  /**
   *
   * @param {Microfleet} service
   * @param {Configuration} config
   */
  constructor(service, config) {
    /**
     * @type {Microfleet}
     */
    this.service = service;

    /**
     * @type {Configuration}
     */
    this.config = config;

    this.log = this.service.log.child({ bypass: this.config.provider });
    this.registerUser = this.registerUser.bind(this);
    this.jwks = new Map();

    if (!this.service.validator.ajv.getSchema(AJV_SCHEME_ID)) {
      this.service.validator.ajv.addSchema({
        $id: AJV_SCHEME_ID,
        type: 'string',
        format: 'uuid',
      });
    }

    this.jwtAudience = this.service.config.jwt.defaultAudience;
  }

  /**
   * @param {string} userId
   * @returns {string} prefixed user id
   */
  static userId(userId) {
    return `sla/${userId}`;
  }

  /**
   * @param {string} userId
   * @returns authenticated user
   */
  async login(userId) {
    const params = {
      username: StreamlayerAnonymousService.userId(userId),
      audience: this.jwtAudience,
      isSSO: true,
    };

    return this.service.dispatch('login', { params });
  }

  /**
   * register user
   * @param {string} userId
   * @param {object} userProfile
   * @returns {Promise<{status: boolean, data?: object}>}
   */
  async registerUser(userId, userProfile) {
    const params = {
      activate: true, // externally validated, no challenge
      username: StreamlayerAnonymousService.userId(userId),
      audience: this.jwtAudience,
      skipPassword: true,
      metadata: {
        firstName: word.sample(4, 10),
        lastName: userIdGenerator(6),
        ...userProfile,
        [this.config.provider]: {
          id: userId, // slr non-prefixed anonymous id
        },
      },
    };

    try {
      const userData = await this.service.dispatch('register', { params });
      return { status: true, data: userData };
    } catch (err) {
      // normal situation: user already exists
      if (err.code === ErrorConflictUserExists.code) {
        this.log.warn({ params }, 'user - exists, skip');
        return { status: false };
      }

      this.log.error({ err }, 'failed to register user');
      throw err;
    }
  }

  async queueRegister(userId, userProfile) {
    // must be able to lock
    try {
      const { status, data } = await this.service.dlock.manager.fanout(
        lockBypass('sl-anon', StreamlayerAnonymousService.userId(userId)),
        5000,
        this.registerUser,
        userId,
        userProfile
      );

      if (status) {
        return data;
      }

      return await this.login(userId);
    } catch (err) {
      this.log.error({ err }, 'registration failed');
      throw new HttpStatusError(500, 'unable to perform user authentication');
    }
  }

  /**
   * Decodes & verifies JWE, returns username & associated profiel
   * @param {string} jwe
   * @param {string} organizationId
   * @returns {Promise<{ userId: string, userProfile: Record<string, any> }>}
   */
  async decodeJWE(jwe, organizationId) {
    // TODO: cache request
    const { data: { attributes } } = await this.service
      .dispatch('organization.getMetadata', { params: { organizationId, audience: this.config.audience } });

    const { pkKey, totpKey } = this.config;
    const totpSecret = attributes[totpKey];
    const pk = attributes[pkKey];
    let ecPrivateKey;
    if (this.jwks.has(pk.kid)) {
      ecPrivateKey = this.jwks.get(pk.kid);
    } else {
      ecPrivateKey = await jose.importJWK(pk);
      this.jwks.set(pk.kid, ecPrivateKey);
    }

    const { plaintext, protectedHeader } = await jose.compactDecrypt(jwe, ecPrivateKey, {
      issuer: this.config.issuers,
      audience: organizationId,
    });

    assert.equal(protectedHeader.kid, pk.kid, 'kid did not match');

    const decodedPayload = sjson.parse(stringDecoder.end(plaintext));

    assert(authenticator.verify({ secret: totpSecret, token: decodedPayload[totpKey] }), 'E_TOTP_MISMATCH');

    try {
      const userId = this.service.validator.ifError(AJV_SCHEME_ID, decodedPayload[this.config.idField]);
      return { userId, userProfile: {} };
    } catch (err) {
      this.log.error({ err, profile: decodedPayload }, 'anonymous auth profile validation failed');
      throw err;
    }
  }

  async registerAndLogin(jwe, account) {
    this.log.debug({ jwe }, 'trying to sign in');

    const { userId, userProfile } = await this.decodeJWE(jwe, account);

    let loginResponse;
    try {
      loginResponse = await this.login(userId);
    } catch (err) {
      if (err !== ErrorUserNotFound) {
        this.log.error({ err }, 'failed to login');
        throw USERS_INVALID_TOKEN;
      }

      this.log.debug('username not found, registering');
      loginResponse = await this.queueRegister(userId, userProfile);
    }

    return loginResponse;
  }

  // profileToken must equal organizatio id we are authenticating with
  /**
   *
   * @param {string} organizationId
   * @param {string} kid
   * @returns {{ token: string }} one-time code
   */
  async session(organizationId, kid) {
    // TODO: cache request
    const { data: { attributes } } = await this.service
      .dispatch('organization.getMetadata', { params: { organizationId, audience: this.config.audience } });

    const { pkKey, totpKey } = this.config;

    // verify that requested key id matches the organization
    assert.equal(attributes[pkKey].kid, kid, 'kid mismatch');

    // generate otp
    const totpSecret = attributes[totpKey];

    // will be used as session identifier
    const token = authenticator.generate(totpSecret);

    return { token };
  }

  async authenticate(profileTokenOrKeyId, { account: organizationId, init }) {
    // ...
    // 1. decode profileToken into profile
    // 2. verify signature, user must be org specific
    // 2a -- profile token must include org-id or? sdk-key, device id, must be encrypted with public key from org id
    // 3a -- add required profile data
    // word.sample({ length: { min: 3, max: 7 } }) for firstname
    // and some letters for second
    //

    if (init) {
      return this.session(organizationId, profileTokenOrKeyId);
    }

    return this.registerAndLogin(profileTokenOrKeyId, organizationId);
  }
}

module.exports = StreamlayerAnonymousService;
