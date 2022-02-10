const { strict: assert } = require('assert');
const got = require('got');

const msUsers = got.extend({
  prefixUrl: 'https://ms-users.local/users/auth-bypass',
  responseType: 'json',
  https: { rejectUnauthorized: false },
});

describe('/bypass/masters', function verifySuite() {
  const profileToken = process.env.MASTERS_PROFILE_TOKEN;
  const msg = {
    schema: 'masters:local',
    userKey: profileToken,
  };

  describe('masters disabled', () => {
    before(() => global.startService());
    after(() => global.clearRedis());

    it('validates its off', async () => {
      await assert.rejects(msUsers.post({ json: msg }), (e) => {
        assert.deepStrictEqual(e.response.body, {
          statusCode: 412,
          error: 'Precondition Failed',
          message: 'masters auth disabled',
          name: 'HttpStatusError',
        });
        return true;
      });
    });
  });

  describe('masters enabled', () => {
    before(() => global.startService({
      bypass: {
        masters: {
          enabled: true,
        },
      },
      validation: {
        templates: {
          register: 'UNKNOWN',
        },
      },
    }));
    after(() => global.clearRedis());

    it('signs in with valid session, non-existent user', async () => {
      const reply = await msUsers.post({ json: msg });
      console.info('%j', reply.body);
      assert(reply.body.jwt);
    });

    it('signs in with valid session, existing user', async () => {
      const reply = await msUsers.post({ json: msg });
      console.info('%j', reply.body);
      assert(reply.body.jwt);
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
