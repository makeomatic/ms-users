/* eslint-disable no-prototype-builtins */
/* global globalRegisterUser, globalAuthUser */

const { authenticator } = require('otplib');
const { inspectPromise } = require('@makeomatic/deploy');
const Promise = require('bluebird');
const assert = require('assert');
const forEach = require('lodash/forEach');

const GraphApi = require('../../../helpers/oauth/facebook/graph-api');
const WebExecuter = require('../../../helpers/oauth/facebook/web-executer');
const GraphAPI = require('../../../helpers/oauth/facebook/graph-api');

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
function checkServiceMissingPermissionsResponse(context) {
  assert.ok(context.$ms_users_inj_post_message);
  assert.equal(context.$ms_users_inj_post_message.type, 'ms-users:attached');
  assert.equal(context.$ms_users_inj_post_message.error, false);
  assert.deepEqual(context.$ms_users_inj_post_message.missingPermissions, ['email']);
  assert.ok(context.$ms_users_inj_post_message.payload.token, 'missing token');
  assert.equal(context.$ms_users_inj_post_message.payload.provider, 'facebook');
}

describe('#facebook', function oauthFacebookSuite() {
  let service;

  this.timeout(240000); // increase timeout

  /**
   * Creates new account in `ms-users` service.
   * Function slightly different from `helpers/registerUser`.
   * @param token
   * @param overwrite
   * @returns {Promise<any> | * | Thenable<any> | PromiseLike<any> | Promise<any>}
   */
  function createAccount(token, overwrite = {}) {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64'));
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
    service = await global.startService(this.testConfig);
    GraphAPI.log = service.log;
  });

  afterEach('stop', async () => {
    await global.clearRedis();
  });

  /**
   * Check that service raises errors from @hapi/bell
   * All OAuth requests are coming to one endpoint and `auth.tests` called before any action
   * so we will test it once
   */
  describe('OAuth Throttling Error Handling', () => {
    const sinon = require('sinon');
    const Boom = require('@hapi/boom');
    const request = require('request-promise');

    const executeLink = `${WebExecuter.serviceLink}/users/oauth/facebook`;
    const serviceHttpRequest = request.defaults({
      method: 'GET',
      strictSSL: false,
      url: executeLink,
    });

    describe('errors from @hapi/bell passed through', async () => {
      beforeEach('stub Errors ', async () => {
        const throttleError = Boom.forbidden('X-Throttled', {});

        /* Stub all oauth calls with custom error */
        /* Bell always returns InternalError with Error, Response or payload in it's data */
        sinon
          .stub(service.http.auth, 'test')
          .throws(() => Boom.internal('BadError', throttleError));
      });

      it('errors from @hapi/bell passed through', async () => {
        let postMessage;
        let statusCode;

        try {
          await serviceHttpRequest();
        } catch (e) {
          const javascriptContext = WebExecuter.getJavascriptContext(e.error);
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
          assert(res == null, 'Res must be deleted from error');
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
          assert(res == null, 'Res must be deleted from error');
        },
      };

      const errorWithDataString = {
        subError: Boom.forbidden('X-Throttled', 'stringData'),
        check: (error) => {
          assert(error.data === 'stringData', 'Must pass string data');
        },
      };

      const errorWithDataNull = {
        subError: Boom.forbidden('X-Throttled'),
        check: (error) => {
          assert.ok(error.data == null, 'Must pass null data');
        },
      };

      const errorWithDataObject = {
        subError: Boom.forbidden('X-Throttled', { foo: 1, bar: 2 }),
        check: (error) => {
          assert.deepEqual(error.data, { foo: 1, bar: 2 }, 'Must pass full data object');
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
          beforeEach('stub Errors ', async () => {
            sinon
              .stub(service.http.auth, 'test')
              .throws(() => Boom.internal('BadError', test.subError));
          });

          it('serializes error correctly', async () => {
            let postMessage;

            try {
              await serviceHttpRequest();
            } catch (e) {
              const javascriptContext = WebExecuter.getJavascriptContext(e.error);
              ({ $ms_users_inj_post_message: postMessage } = javascriptContext);
            }

            const { inner_error: innerError } = postMessage.payload;
            test.check(innerError.data);
          });
        });
      });
    });

    /**
     * Internal check. Just to be sure if Throttling Happened during test suites.
     */
    describe('WebExecuter generate custom throttling error', async () => {
      let fb;

      /* Simulates situation when timeout happens */
      const simulateTimeout = async () => {
        try {
          await fb.navigatePage({ href: executeLink });
          // we use stubbed response so timeout is small
          await fb.page.waitForSelector('input#email', { timeout: 1000 });
        } catch (e) {
          await fb.processPageError(e);
        }
      };

      before('start WebExcuter', async () => {
        fb = new WebExecuter();
        await fb.start();
      });

      beforeEach('stub Errors ', async () => {
        const throttleError = Boom.forbidden('X-Throttled', {});
        sinon
          .stub(service.http.auth, 'test')
          .throws(() => Boom.internal('BadError', throttleError));
      });

      it('WebExecuter generate custom throttling error', async () => {
        let executerError;

        try {
          await simulateTimeout();
        } catch (error) {
          executerError = error;
        }

        assert.ok(executerError, 'Should be error');
        assert(executerError instanceof WebExecuter.TimeoutError, 'Must be instance of WebExecuter.TimeoutError');
        assert(executerError.status_code === 500, 'Status code must be set');
        assert.ok(executerError.page_contents, 'Must include service message or last response');
      });

      after('stop WebExecuter', async () => {
        await fb.stop();
      });
    });
  });

  /**
   * Suite works with 'Fresh' user.
   * Application has any access to the users Facebook profile.
   * This suite don't need to recreate user for each test and we can use one AuthToken in all tests.
   */
  describe('new user', async function newUserTest() {
    let generalUser;
    this.slow(60000);

    before('create test user', async () => {
      generalUser = await GraphApi.createTestUser();
    });

    after('delete test user', async () => {
      await GraphApi.deleteTestUser(generalUser);
    });

    /**
     * Checking general functionality just to be ensured that we can receive `token` or handle `Declined` Facebook Auth Request
     */
    describe('general checks', async () => {
      let fb;

      beforeEach('start WebExecuter', async () => {
        fb = new WebExecuter('general-checks');
        await fb.start();
      });

      afterEach('stop WebExecuter', async () => {
        await fb.stop();
      });

      afterEach('deauth App', async () => {
        await GraphApi.deAuthApplication(generalUser);
      });

      it('should able to handle declined authentication', async () => {
        const { status, url } = await fb.rejectAuth(generalUser);
        console.log('Decline', status, url);
        assert(status === 401, `statusCode is ${status}, url is ${url}`);
      });

      it('should able to retrieve faceboook profile', async () => {
        const { token: resToken, body } = await fb.getToken(generalUser);
        assert(resToken, `did not get token - ${resToken} - ${body}`);
      });
    });

    /**
     * Suite checks general service behavior.
     * Token retrieved once and all tests use it.
     */
    describe('service register/create/detach', () => {
      let fb;
      let token;

      /* Should be 'before' hook, but Mocha executes it before starting our service.  */
      before('start WebExecuter', async () => {
        fb = new WebExecuter('register-create-detach');
      });

      beforeEach('get Facebook token', async () => {
        if (token != null) {
          return;
        }

        await fb.start();
        token = (await fb.getToken(generalUser)).token;
        await fb.stop();
      });

      /* Cleanup App permissions for further user reuse */
      after('deauth application', async () => {
        await GraphApi.deAuthApplication(generalUser);
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

        forEach(response.metadata, (audience) => {
          assert.ifError(audience.facebook);
        });

        /* verify that related account has been pruned from internal data */
        response = await service
          .dispatch('getInternalData', { params: { username } });

        assert.ifError(response.facebook, 'did not detach fb');

        /* verify that related account has been dereferenced */
        const error = await service
          .dispatch('getInternalData', { params: { username: uid } })
          .reflect()
          .then(inspectPromise(false));

        assert.equal(error.statusCode, 404);
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
      let fb;
      let token;
      let dataBag;
      const username = 'facebookuser@me.com';
      /* Should be 'before' hook, but Mocha executes it before starting our service.  */
      beforeEach('init WebExecuter, get Facebook token, register user', async () => {
        if (!fb || typeof fb === 'undefined') {
          fb = new WebExecuter('login-attach');
          await fb.start();
          ({ token } = await fb.getToken(generalUser));
        }

        dataBag = { service };
        await globalRegisterUser(username).call(dataBag);
        await globalAuthUser(username).call(dataBag);
      });

      after('stop executer', async () => {
        await fb.stop();
      });

      /* IF test reordering occurs this going to save us from headache */
      after('deauth application', async () => {
        await GraphApi.deAuthApplication(generalUser);
      });

      it('should reject attaching already attached profile to a new user', async () => {
        await createAccount(token);
        await Promise.delay(1000);

        const { status, url } = await fb.signInWithToken(dataBag.jwt);
        assert(status === 412, `Page is ${url} and status is ${status}`);

        const message = await fb.extractMsUsersPostMessage();
        assert.ok(message);
        assert.equal(message.type, 'ms-users:attached');
        assert.equal(message.error, true);
        assert.deepEqual(message.payload, {
          status: 412,
          statusCode: 412,
          status_code: 412,
          name: 'HttpStatusError',
          message: 'profile is linked',
        });
      });

      it('should attach facebook profile to existing user', async () => {
        await Promise.delay(1000);
        const { status, url, body } = await fb.signInWithToken(dataBag.jwt);
        assert(status === 200, `Page is ${url} and status is ${status}`);

        const message = await fb.extractMsUsersPostMessage();

        assert(message, `post message not present: ${body}`);
        assert(message.type === 'ms-users:attached', `type wrong -> ${body}`);
        assert(Object.keys(message.payload).length);
      });

      it('should be able to sign in with facebook account', async () => {
        await Promise.delay(1000);
        const executeLink = `${fb._serviceLink}/users/oauth/facebook`;

        /* initial request for attaching account */
        const preRequest = await fb.signInWithToken(dataBag.jwt);
        assert(preRequest.status === 200, `attaching account failed - ${preRequest.status} - ${preRequest.url}`);

        const { status, url } = await fb.navigatePage({ href: executeLink });
        assert(status === 200, `signing in failed - ${status} - ${url}`);

        const message = await fb.extractMsUsersPostMessage();

        assert.ok(message);
        assert.equal(message.error, false);
        assert.equal(message.type, 'ms-users:logged-in');

        const { payload } = message;
        checkServiceOkResponse(payload);
      });

      it('should be able to sign in with facebook account if mfa is enabled', async function test() {
        await Promise.delay(1000);
        /* enable mfa */
        const { secret } = await service.dispatch('mfa.generate-key', { params: { username, time: Date.now() } });
        await service.dispatch('mfa.attach', {
          params: {
            username,
            secret,
            totp: authenticator.generate(secret),
          },
        });

        const executeLink = `${fb._serviceLink}/users/oauth/facebook`;

        /* initial request for attaching account */
        const preRequest = await fb.signInWithToken(dataBag.jwt);
        assert(preRequest.status === 200, `attaching account failed - ${preRequest.status} - ${preRequest.url}`);

        const { status, url } = await fb.navigatePage({ href: executeLink });
        assert(status === 403, `mfa was not requested - ${status} - ${url}`);

        const message = await fb.extractMsUsersPostMessage();

        assert.ok(message);
        assert.equal(message.error, true);
        assert.equal(message.type, 'ms-users:totp_required');

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
    let fb;
    let partialUser;

    before('create test user', async () => {
      partialUser = await GraphApi.createTestUser({
        permissions: 'public_profile',
      });
    });

    after('delete test user', async () => {
      await GraphApi.deleteTestUser(partialUser);
    });

    beforeEach('start WebExecuter', async () => {
      fb = new WebExecuter('partial-user');
      await fb.start();
    });

    afterEach('stop WebExecuter', async () => {
      await fb.stop();
    });

    afterEach('deauth application', async () => {
      await GraphApi.deAuthApplication(partialUser);
    });

    it('should reject when signing in with partially returned scope and report it', async () => {
      const data = await fb.signInAndNavigate(partialUser, (response) => {
        return response.url().startsWith(fb._serviceLink) && response.status() === 401;
      });

      const status = data.status();
      const url = data.url();
      const body = await data.text();

      assert(status === 401, `did not reject partial sign in - ${status} - ${url} - ${body}`);

      const context = WebExecuter.getJavascriptContext(body);

      assert.ok(context.$ms_users_inj_post_message);
      assert.deepEqual(context.$ms_users_inj_post_message.payload, {
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
        const pageResponse = await fb.signInAndNavigate(partialUser, (response) => {
          return /dialog\/oauth\?auth_type=rerequest/.test(response.url());
        });

        const url = pageResponse.url();
        const status = pageResponse.status();

        assert(/dialog\/oauth\?auth_type=rerequest/.test(url), `failed to redirect back - ${status} - ${url}`);
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
        const data = await fb.signInAndNavigate(partialUser, (response) => {
          return response.url().startsWith(fb._serviceLink) && response.status() === 200;
        });

        const body = await data.text();
        const context = WebExecuter.getJavascriptContext(body);

        checkServiceMissingPermissionsResponse(context);
      });

      it('should register with partially returned scope and require email verification', async () => {
        const data = await fb.signInAndNavigate(partialUser, (response) => {
          return response.url().startsWith(fb._serviceLink) && response.status() === 200;
        });

        const status = data.status();
        const url = data.url();
        const body = await data.text();

        assert(status === 200, `failed to redirect back - ${status} - ${url} - ${body}`);

        const context = WebExecuter.getJavascriptContext(body);

        checkServiceMissingPermissionsResponse(context);

        const { requiresActivation, id } = await createAccount(
          context.$ms_users_inj_post_message.payload.token,
          { username: 'unverified@makeomatic.ca' }
        );

        assert.equal(requiresActivation, true);
        assert.ok(id);
      });

      after('remove', () => {
        delete this.testConfig;
      });
    });
  });
});
