const { strict: assert } = require('assert');
const got = require('got');
const { startService, clearRedis } = require('../../../config');

const msUsers = got.extend({
  prefixUrl: 'https://ms-users.local/users/auth-bypass',
  responseType: 'json',
  https: { rejectUnauthorized: false },
});

describe.skip('/bypass/pump-jack', function verifySuite() {
  const profileToken = process.env.PUMP_JACK_PROFILE_TOKEN;
  const msg = {
    schema: 'pumpJack:imcf',
    userKey: profileToken,
  };

  describe('pump-jack disabled', () => {
    before(() => startService());
    after(() => clearRedis());

    it('validates its off', async () => {
      await assert.rejects(msUsers.post({ json: msg }), (e) => {
        assert.deepStrictEqual(e.response.body, {
          statusCode: 412,
          error: 'Precondition Failed',
          message: 'pumpJack auth disabled',
          name: 'HttpStatusError',
        });
        return true;
      });
    });
  });

  describe('pump-jack enabled', () => {
    before(() => startService({
      bypass: {
        pumpJack: {
          enabled: true,
        },
      },
      validation: {
        templates: {
          register: 'UNKNOWN',
        },
      },
    }));
    after(() => clearRedis());

    it('signs in with valid session, non-existent user', async () => {
      const pristine = await msUsers.post({ json: msg });
      console.info('%j', pristine.body);
    });

    it('signs in with valid session, existing user', async () => {
      const second = await msUsers.post({ json: msg });
      console.info('%j', second.body);
    });

    it('rejects on invalid session uid', async () => {
      await assert.rejects(msUsers.post({ json: { ...msg, userKey: 'invalid' } }), (e) => {
        assert.deepStrictEqual(e.response.body, {
          statusCode: 403,
          error: 'Forbidden',
          message: 'invalid token',
          name: 'HttpStatusError',
        });
        return true;
      });
    });
  });
});
