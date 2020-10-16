/* eslint-disable no-prototype-builtins */
/* global globalRegisterUser, globalAuthUser */

const { authenticator } = require('otplib');
const Promise = require('bluebird');
const assert = require('assert');
const got = require('got');
const GraphApi = require('../../../helpers/oauth/facebook/graph-api');

const kDefaultAudience = '*.localhost';
const msUsers = got.extend({
  prefixUrl: 'https://ms-users.local/users/oauth/upgrade',
  responseType: 'json',
  https: {
    rejectUnauthorized: false,
  },
});

/**
 * Checking whether user successfully logged-in or registered
 * @param payload
 */
function checkServiceOkResponse(payload) {
  assert(payload.hasOwnProperty('jwt'));
  assert(payload.hasOwnProperty('user'));
  assert(payload.user.hasOwnProperty('metadata'));
  assert(payload.user.metadata.hasOwnProperty(kDefaultAudience));
  assert(payload.user.metadata[kDefaultAudience].hasOwnProperty('facebook'));
  assert.ifError(payload.user.password);
  assert.ifError(payload.user.audience);
}

/**
 * Check whether service responded with 'missing permissions'
 * Used in tests checking partial permission access
 * @param context
 */
function checkServiceMissingPermissionsResponse(context) {
  assert.strictEqual(context.type, 'ms-users:signed');
  assert.strictEqual(context.error, false);
  assert.deepStrictEqual(context.missingPermissions, ['email']);
  assert.ok(context.payload.token, 'missing token');
  assert.strictEqual(context.payload.provider, 'facebook');
}

describe('oauth#upgrade', function oauthFacebookSuite() {
  let service;
  let generalUser;
  let token;

  /**
   * Creates new account in `ms-users` service.
   * Function slightly different from `helpers/registerUser`.
   * @param {string} token
   * @param {object} [overwrite]
   * @returns {Promise<any> | * | Thenable<any> | PromiseLike<any> | Promise<any>}
   */
  function createAccount(sso, overwrite = {}) {
    const payload = JSON.parse(Buffer.from(sso.split('.')[1], 'base64'));
    const opts = {
      username: payload.email,
      password: 'mynicepassword',
      audience: kDefaultAudience,
      metadata: {
        service: 'craft',
      },
      sso,
      ...overwrite,
    };

    return service.dispatch('register', { params: opts });
  }

  /**
   * @param {string} sso - facebook access token
   * @param {string} [jwt]
   * @param {string} [msg]
   * @returns {Promise<{ body: any, statusCode: number, payload: any, missingPermissions?: string[] }>}
   */
  async function upgradeToken(sso, jwt, msg = 'signed') {
    const json = { provider: 'facebook', token: sso };
    if (jwt) { json.jwt = jwt; }

    const { statusCode, body } = await msUsers.post({ json });
    const { error, type, payload, missingPermissions } = body;

    assert.strictEqual(error, false);
    assert.strictEqual(type, `ms-users:${msg}`);

    return { body, payload, statusCode, missingPermissions };
  }

  /* Restart service before each test to achieve clean database. */
  beforeEach('start', async () => {
    service = await global.startService(this.testConfig);
  });

  afterEach('stop', async () => {
    await global.clearRedis();
  });

  /**
   * Suite works with 'Fresh' user.
   * Application has any access to the users Facebook profile.
   * This suite don't need to recreate user for each test and we can use one AuthToken in all tests.
   */
  describe('new user', async function newUserTest() {
    beforeEach('create test user', async () => {
      generalUser = await GraphApi.getTestUserWithPermissions(['public_profile', 'email']);
    });

    beforeEach('exchanges fb access_token to ms-users signed token', async () => {
      const data = await upgradeToken(generalUser.access_token);
      token = data.payload.token;
    });

    /**
     * Suite checks general service behavior.
     * Token retrieved once and all tests use it.
     */
    describe('service register/create/detach', () => {
      it('should be able to register via facebook', async () => {
        const registered = await createAccount(token);
        checkServiceOkResponse(registered);
      });

      it('can get info about registered fb account through getInternalData & getMetadata', async () => {
        const { user } = await createAccount(token);
        const { uid } = user.metadata[kDefaultAudience].facebook;

        const [internalData, metadata] = await Promise.all([
          service.amqp.publishAndWait('users.getInternalData', {
            username: uid,
          }),
          service.amqp.publishAndWait('users.getMetadata', {
            username: uid,
            audience: kDefaultAudience,
          }),
        ]);

        /* verify internal data */
        const internalFbData = internalData.facebook;
        assert.ok(internalFbData, 'facebook data not present');
        assert.ok(internalFbData.id, 'fb id is not present');
        assert.ok(internalFbData.email, 'fb email is not present');
        assert.ok(internalFbData.token, 'fb token is not present');
        assert.ifError(internalFbData.username, 'fb returned real username');
        assert.ifError(internalFbData.refreshToken, 'fb returned refresh token');

        /* verify metadata */
        const fbData = metadata[kDefaultAudience].facebook;
        assert.ok(fbData, 'facebook profile not present');
        assert.ok(fbData.id, 'facebook scoped is not present');
        assert.ok(fbData.displayName, 'fb display name not present');
        assert.ok(fbData.name, 'fb name not present');
        assert.ok(fbData.uid, 'internal fb uid not present');
      });

      it('should detach facebook profile', async () => {
        const registered = await createAccount(token);

        checkServiceOkResponse(registered);

        const uid = `facebook:${registered.user.metadata[kDefaultAudience].facebook.id}`;
        const { username } = registered.user.metadata['*.localhost'];
        let response;

        response = await service.dispatch('oauth.detach', {
          params: {
            username,
            provider: 'facebook',
          },
        });

        assert(response.success, 'werent able to detach');

        /* verify that related account has been pruned from metadata */
        response = await service.dispatch('getMetadata', {
          params: {
            username,
            audience: Object.keys(registered.user.metadata),
          },
        });

        for (const audience of Object.values(response)) {
          assert.ifError(audience.facebook);
        }

        /* verify that related account has been pruned from internal data */
        response = await service.dispatch('getInternalData', { params: { username } });

        assert.ifError(response.facebook, 'did not detach fb');

        /* verify that related account has been dereferenced */
        await assert.rejects(
          service.dispatch('getInternalData', { params: { username: uid } }),
          { statusCode: 404 }
        );
      });
    });

    /**
     * Suite Checks Login/Attach profile possibility
     * In this suite, FacebookAuth process performed once and token saved in memory.
     * Service users created before tests to remove code deduplication.
     * Previous version was restarting Auth process and getting new token before each test.
     * This version repeats same behavior but without repeating auth and get token processes.
     */
    describe('service login/attach', () => {
      let dataBag;
      const username = 'facebookuser@me.com';

      /* Should be 'before' hook, but Mocha executes it before starting our service.  */
      beforeEach('get Facebook token, register user', async () => {
        dataBag = { service };
        await globalRegisterUser(username).call(dataBag);
        await globalAuthUser(username).call(dataBag);
      });

      it('should reject attaching already attached profile to a new user', async () => {
        await createAccount(token);
        await assert.rejects(upgradeToken(generalUser.access_token, dataBag.jwt), (e) => {
          return e.response
            && e.response.statusCode === 412
            && e.response.body.type === 'ms-users:attached'
            && e.response.body.error === true
            && e.response.body.payload.name === 'HttpStatusError'
            && e.response.body.payload.message === 'profile is linked'
            && e.response.body.payload.statusCode === 412;
        });
      });

      it('should attach facebook profile to existing user', async () => {
        const { body, statusCode } = await upgradeToken(generalUser.access_token, dataBag.jwt, 'attached');
        assert.strictEqual(statusCode, 200);
        assert.strictEqual(body.type, 'ms-users:attached');
        assert.ok(Object.keys(body.payload).length);
      });

      it('should be able to sign in with facebook account', async () => {
        const preRequest = await upgradeToken(generalUser.access_token, dataBag.jwt, 'attached');
        assert.strictEqual(preRequest.statusCode, 200);

        const { statusCode, payload } = await upgradeToken(generalUser.access_token, null, 'logged-in');
        assert.strictEqual(statusCode, 200);
        checkServiceOkResponse(payload);
      });

      it('should be able to sign in with facebook account if mfa is enabled', async function test() {
        const { secret } = await service.dispatch('mfa.generate-key', {
          params: { username, time: Date.now() },
        });

        await service.dispatch('mfa.attach', {
          params: {
            username,
            secret,
            totp: authenticator.generate(secret),
          },
        });

        /* initial request for attaching account */
        const preRequest = await upgradeToken(generalUser.access_token, dataBag.jwt, 'attached');
        assert.strictEqual(preRequest.statusCode, 200);

        let body;
        await assert.rejects(upgradeToken(generalUser.access_token), (e) => {
          body = e.response && e.response.body;
          return e.response
            && e.response.statusCode === 403
            && body.error === true
            && body.type === 'ms-users:totp_required'
            && !!body.payload.userId
            && !!body.payload.token;
        });

        const { payload: { userId, token: localToken } } = body;
        const login = await service.dispatch(
          'login', {
            params: {
              username: userId,
              password: localToken,
              isOAuthFollowUp: true,
              audience: kDefaultAudience,
            },
            headers: {
              'x-auth-totp': authenticator.generate(secret),
            },
          }
        );

        checkServiceOkResponse(login);
      });
    });
  });

  /**
   * Suite works with 'Partial' user.
   * Application must be granted with some permissions and not installed,
   * but In this case the Facebook permission request showing full permissions (partial permissions ignored when the test user created).
   * All tests perform Facebook Auth -> Uncheck 1 permission on Facebook App Access request -> clicking "Confirm" button
   * After each test Deletes all application permissions this uninstalls application from user.
   * NOTE:
   * We don't need to test same behavior for user with app `installed`.
   * OAuth API endpoint behavior is same, and tests code will be copied from this suite.
   */
  describe('partial user', async () => {
    let partialUser;

    before('create test user', async () => {
      partialUser = await GraphApi.getTestUserWithPermissions(['public_profile']);
    });

    describe('should login/register with partially returned scope and report it', () => {
      it('should login with partially returned scope and report it', async () => {
        const { body } = await upgradeToken(partialUser.access_token);
        checkServiceMissingPermissionsResponse(body);
      });

      it('should register with partially returned scope and require email verification', async () => {
        const { statusCode, body } = await upgradeToken(partialUser.access_token);

        assert.strictEqual(statusCode, 200);
        checkServiceMissingPermissionsResponse(body);

        const { requiresActivation, id } = await createAccount(body.payload.token, {
          username: 'unverified@makeomatic.ca',
        });

        assert.strictEqual(requiresActivation, true);
        assert.ok(id);
      });
    });
  });
});
