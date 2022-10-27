/* eslint-disable no-prototype-builtins */
/* global globalRegisterUser, globalAuthUser */

const { authenticator } = require('otplib');
const Promise = require('bluebird');
const assert = require('assert');
const Bell = require('@hapi/bell');
const Boom = require('@hapi/boom');
const got = require('got');
const clone = require('rfdc')();

const msUsers = got.extend({
  prefixUrl: 'https://ms-users.local/users/oauth/facebook',
  responseType: 'text',
  retry: 0,
  followRedirect: false,
  https: {
    rejectUnauthorized: false,
  },
});

const GraphApi = require('../../../helpers/oauth/facebook/graph-api');
const WebExecuter = require('../../../helpers/oauth/facebook/web-executer');

/* Set our service url */
WebExecuter.serviceLink = 'https://ms-users.local';

const kDefaultAudience = '*.localhost';

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
function checkServiceMissingPermissionsResponse(context, type = 'attached') {
  assert.strictEqual(context.type, `ms-users:${type}`);
  assert.strictEqual(context.error, false);
  assert.deepEqual(context.missingPermissions, ['email']);
  assert.ok(context.payload.token, 'missing token');
  assert.strictEqual(context.payload.provider, 'facebook');
}

const profileCache = Object.create(null);

// https://github.com/hapijs/bell/blob/master/lib/oauth.js#L164
const getRejectError = (reason = 'No information provided', credentials = { provider: 'facebook' }) => {
  return Boom.internal(`App rejected: ${reason}`, { credentials });
};

const getSimulatedRequestForUser = (service, user) => async (request) => {
  const providerSettings = service.oauth.app.oauthProviderSettings.facebook;
  const { profile } = providerSettings.provider;
  const initialReq = { token: user.access_token, query: request.query };

  if (profileCache[initialReq.token]) {
    return clone(profileCache[initialReq.token]);
  }

  profileCache[initialReq.token] = await profile.call(providerSettings, initialReq);
  return clone(profileCache[initialReq.token]);
};

const t = process.env.DB_SRV === 'redisSentinel' && process.env.CI === 'true'
  ? describe.skip
  : describe;

t('#facebook', function oauthFacebookSuite() {
  let service;
  let simulateReq;

  /**
   * Creates new account in `ms-users` service.
   * Function slightly different from `helpers/registerUser`.
   * @param token
   * @param overwrite
   * @returns {Promise<any> | * | Thenable<any> | PromiseLike<any> | Promise<any>}
   */
  function createAccount(token, overwrite = {}) {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64'));

    assert.ok(payload.email || overwrite.username, 'email is empty');

    const opts = {
      username: payload.email,
      password: 'mynicepassword',
      audience: kDefaultAudience,
      metadata: {
        service: 'craft',
      },
      sso: token,
      ...overwrite,
    };

    return service.dispatch('register', { params: opts });
  }

  /* Restart service before each test to achieve clean database. */
  beforeEach('start', async () => {
    Bell.simulate((req) => {
      if (simulateReq) {
        return simulateReq(req);
      }

      throw Boom.badRequest();
    });

    service = await global.startService(this.testConfig);
  });

  afterEach('stop', async () => {
    await global.clearRedis();
    Bell.simulate(false);
    simulateReq = false;
  });

  /**
   * Check that service raises errors from @hapi/bell
   * All OAuth requests are coming to one endpoint and `auth.tests` called before any action
   * so we will test it once
   */
  describe('OAuth Throttling Error Handling', () => {
    describe('errors from @hapi/bell passed through', async () => {
      beforeEach('stub Errors ', async () => {
        const throttleError = Boom.forbidden('X-Throttled', {});

        /* Stub all oauth calls with custom error */
        /* Bell always returns InternalError with Error, Response or payload in it's data */
        simulateReq = () => {
          throw Boom.internal('BadError', throttleError);
        };
      });

      it('errors from @hapi/bell passed through', async () => {
        let postMessage;
        let statusCode;

        try {
          await msUsers.get();
        } catch (e) {
          const javascriptContext = WebExecuter.getJavascriptContext(e.response.body);
          ({ statusCode } = e.response);
          ({ $ms_users_inj_post_message: postMessage } = javascriptContext);
        }

        assert(statusCode === 500, 'Should respond with Internal error');
        /* message exists and it's an error */
        assert.ok(postMessage);
        assert(postMessage.error === true);

        /* error message from stubbed error */
        const { payload } = postMessage;
        assert(payload.message === 'BadError');
      });
    });

    describe('service OAuth error serialization ', async () => {
      /* errors coming from Facebook Graph API contain http.IncomingMessage as res property */
      /* and isResponseError property set */
      const errorWithRes = {
        subError: Boom.forbidden('X-Throttled', {
          isResponseError: true,
          i_am_very_long_body: true,
          res: {
            must_be_deleted: true,
          },
        }),
        check: (error) => {
          const { data: { res } } = error;
          assert(res == null);
        },
      };

      const errorWithFirstLevelRes = {
        subError: {
          isResponseError: true,
          res: {
            must_be_deleted: true,
          },
        },
        check: (error) => {
          const { res } = error;
          assert(res == null);
        },
      };

      const errorWithDataString = {
        subError: Boom.forbidden('X-Throttled', 'stringData'),
        check: (error) => {
          assert(error.data === 'stringData');
        },
      };

      const errorWithDataNull = {
        subError: Boom.forbidden('X-Throttled'),
        check: (error) => {
          assert.ok(error.data == null);
        },
      };

      const errorWithDataObject = {
        subError: Boom.forbidden('X-Throttled', { foo: 1, bar: 2 }),
        check: (error) => {
          assert.deepEqual(error.data, { foo: 1, bar: 2 });
        },
      };

      const tests = [
        errorWithRes,
        errorWithFirstLevelRes,
        errorWithDataString,
        errorWithDataNull,
        errorWithDataObject,
      ];

      tests.forEach((test) => {
        describe('serializes error correctly', () => {
          beforeEach('stub Errors ', () => {
            simulateReq = () => {
              throw Boom.internal('BadError', test.subError);
            };
          });

          it('serializes error correctly', async () => {
            let postMessage;

            try {
              await msUsers.get();
            } catch (e) {
              const javascriptContext = WebExecuter.getJavascriptContext(e.response.body);
              ({ $ms_users_inj_post_message: postMessage } = javascriptContext);
            }

            const { inner_error: innerError } = postMessage.payload;
            test.check(innerError.data);
          });
        });
      });
    });
  });

  /**
   * Suite works with 'Fresh' user.
   * Application has any access to the users Facebook profile.
   * This suite don't need to recreate user for each test and we can use one AuthToken in all tests.
   */
  describe('new user', async function newUserTest() {
    /**
     * @type {{ id: string, access_token: string | undefined, login_url: string, email?: string }}
     */
    let generalUser;

    before(async () => {
      generalUser = await GraphApi.getTestUserWithPermissions(['public_profile', 'email']);
    });

    /**
     * Checking general functionality just to be ensured that we can receive `token` or handle `Declined` Facebook Auth Request
     */
    describe('general checks', async () => {
      it('should able to handle declined authentication', async () => {
        simulateReq = () => {
          throw getRejectError('test declined');
        };

        await assert.rejects(msUsers.get(), (e) => {
          return e.response.statusCode === 401;
        });
      });

      it('should able to retrieve faceboook profile', async () => {
        simulateReq = getSimulatedRequestForUser(service, generalUser);
        const { body } = await msUsers.get();
        const context = WebExecuter.extractPostMessageResponse(body);
        assert(context.payload.token, `did not get token - ${JSON.stringify(context)}`);
      });
    });

    /**
     * Suite checks general service behavior.
     * Token retrieved once and all tests use it.
     */
    describe.skip('service register/create/detach', () => {
      let token;

      it('get Facebook token', async () => {
        simulateReq = getSimulatedRequestForUser(service, generalUser);
        const { body } = await msUsers.get();
        token = WebExecuter.extractPostMessageResponse(body).payload.token;
      });

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

        const { uid } = registered.user.metadata[kDefaultAudience].facebook;
        const { username } = registered.user.metadata['*.localhost'];
        let response;

        assert(username, 'fb username wasnt captured');

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

        // NOTE: check whats iin
        for (const audience of Object.values(response)) {
          assert.ifError(audience.facebook);
        }

        /* verify that related account has been pruned from internal data */
        response = await service
          .dispatch('getInternalData', { params: { username } });

        assert.ifError(response.facebook, 'did not detach fb');

        /* verify that related account has been dereferenced */
        await assert.rejects(service.dispatch('getInternalData', { params: { username: uid } }), {
          statusCode: 404,
        });
      });
    });

    /**
     * Suite Checks Login/Attach profile possibility
     * In this suite, FacebookAuth process performed once and token saved in memory.
     * Service users created before tests to remove code deduplication.
     * Previous version was restarting Auth process and getting new token before each test.
     * This version repeats same behavior but without repeating auth and get token processes.
     */
    describe.skip('service login/attach', () => {
      let token;
      let dataBag;

      const username = 'facebookuser@me.com';

      /* Should be 'before' hook, but Mocha executes it before starting our service.  */
      beforeEach('get Facebook token, register user', async () => {
        simulateReq = getSimulatedRequestForUser(service, generalUser);
        const { body } = await msUsers.get();
        token = WebExecuter.extractPostMessageResponse(body).payload.token;

        dataBag = { service };
        await globalRegisterUser(username).call(dataBag);
        await globalAuthUser(username).call(dataBag);
      });

      it('should reject attaching already attached profile to a new user', async () => {
        await createAccount(token);
        await assert.rejects(msUsers.get({ searchParams: { jwt: dataBag.jwt } }), ({ response }) => {
          const context = WebExecuter.extractPostMessageResponse(response.body);

          return response.statusCode === 412
            && context
            && context.type === 'ms-users:attached'
            && context.error === true
            && context.payload.statusCode === 412
            && context.payload.name === 'HttpStatusError'
            && context.payload.message === 'profile is linked';
        });
      });

      it('should attach facebook profile to existing user', async () => {
        const { statusCode, body } = await msUsers.get({ searchParams: { jwt: dataBag.jwt } });
        assert.strictEqual(statusCode, 200);

        const message = await WebExecuter.extractPostMessageResponse(body);

        assert.ok(message, `post message not present: ${body}`);
        assert.strictEqual(message.type, 'ms-users:attached', `type wrong -> ${body}`);
        assert.ok(Object.keys(message.payload).length);
      });

      it('should be able to sign in with facebook account', async () => {
        /* initial request for attaching account */
        const preRequest = await msUsers.get({ searchParams: { jwt: dataBag.jwt } });
        assert.strictEqual(preRequest.statusCode, 200);

        // now that the account is linked - access same endpoint without JWT and ensure we get it back
        const { statusCode, body } = await msUsers.get();
        assert.strictEqual(statusCode, 200, `signing in failed - ${statusCode}`);

        const message = WebExecuter.extractPostMessageResponse(body);

        assert.ok(message);
        assert.strictEqual(message.error, false);
        assert.strictEqual(message.type, 'ms-users:logged-in');
        checkServiceOkResponse(message.payload);
      });

      it('should be able to sign in with facebook account if mfa is enabled', async function test() {
        /* enable mfa */
        const { secret } = await service.dispatch('mfa.generate-key', { params: { username, time: Date.now() } });
        await service.dispatch('mfa.attach', {
          params: {
            username,
            secret,
            totp: authenticator.generate(secret),
          },
        });

        /* initial request for attaching account */
        const preRequest = await msUsers.get({ searchParams: { jwt: dataBag.jwt } });
        assert.strictEqual(preRequest.statusCode, 200, `attaching account failed - ${preRequest.statusCode}`);

        /* must request MFA */
        let body;
        await assert.rejects(msUsers.get(), ({ response }) => {
          body = response.body;
          return response.statusCode === 403;
        });

        const message = WebExecuter.extractPostMessageResponse(body);

        assert.ok(message);
        assert.strictEqual(message.error, true);
        assert.strictEqual(message.type, 'ms-users:totp_required');

        const { payload: { userId, token: localToken } } = message;
        const login = await service.dispatch(
          'login',
          {
            params: { username: userId, password: localToken, isOAuthFollowUp: true, audience: kDefaultAudience },
            headers: { 'x-auth-totp': authenticator.generate(secret) },
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

    beforeEach('create test user', async () => {
      partialUser = await GraphApi.getTestUserWithPermissions(['public_profile']);
      simulateReq = getSimulatedRequestForUser(service, partialUser);
    });

    afterEach('deauth application', async () => {
      await GraphApi.deAuthApplication(partialUser);
    });

    it('should reject when signing in with partially returned scope and report it', async () => {
      let body;
      await assert.rejects(msUsers.get(), ({ response }) => {
        body = response.body;
        return response.statusCode === 401;
      });

      const context = WebExecuter.extractPostMessageResponse(body);
      assert.deepEqual(context.payload, {
        args: { 0: 'missing permissions - email' },
        message: 'An attempt was made to perform an operation without authentication: missing permissions - email',
        name: 'AuthenticationRequiredError',
        missingPermissions: ['email'],
      });
    });

    describe('should re-request partially returned scope endlessly', () => {
      before('apply', () => {
        this.testConfig = {
          oauth: { providers: { facebook: { retryOnMissingPermissions: true } } },
        };
      });

      it('should re-request partially returned scope endlessly', async () => {
        const { statusCode, headers } = await msUsers.get();
        assert.strictEqual(statusCode, 302);
        assert.ok(/\?auth_type=rerequest&scope=email/.test(headers.location), headers.location); // due to simulation the URL is still ours
      });

      after('remove', () => {
        delete this.testConfig;
      });
    });

    describe('should login/register with partially returned scope and report it', () => {
      before('apply', () => {
        this.testConfig = {
          oauth: { providers: { facebook: { retryOnMissingPermissions: false } } },
        };
      });

      it('should login with partially returned scope and report it', async () => {
        const { body } = await msUsers.get();
        const context = WebExecuter.extractPostMessageResponse(body);
        checkServiceMissingPermissionsResponse(context, 'signed');
      });

      it('should register with partially returned scope and require email verification', async () => {
        const { body } = await msUsers.get();
        const context = WebExecuter.extractPostMessageResponse(body);
        checkServiceMissingPermissionsResponse(context, 'signed');

        const { requiresActivation, id } = await createAccount(context.payload.token, { username: 'unverified@makeomatic.ca' });

        assert.strictEqual(requiresActivation, true);
        assert.ok(id);
      });

      after('remove', () => {
        delete this.testConfig;
      });
    });
  });
});
