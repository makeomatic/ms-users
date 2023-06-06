const { strict: assert } = require('assert');
const got = require('got');
const { startService, clearRedis } = require('../../../config');

const msUsers = got.extend({
  prefixUrl: 'https://ms-users.local/users/auth-bypass',
  responseType: 'json',
  https: { rejectUnauthorized: false },
});

const mastersSimulation = got.extend({
  prefixUrl: process.env.MASTERS_SIMULATION_API,
  responseType: 'json',
  headers: {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:97.0) Gecko/20100101 Firefox/97.0',
  },
});

const t = process.env.SKIP_MASTERS === 'true'
  ? describe.skip
  : describe;

t('/bypass/masters', function verifySuite() {
  const pwd = process.env.MASTERS_PROFILE_PASSWORD;
  const username = process.env.MASTERS_PROFILE_USERNAME;
  let msg;
  let profile;

  before(async () => {
    profile = await mastersSimulation.post({ json: {
      provider: 'masters',
      username,
      password: pwd,
    } }).json();

    msg = {
      schema: 'masters:local',
      userKey: profile.token,
    };
  });

  t('masters disabled', () => {
    before(() => startService());
    after(() => clearRedis());

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

  t('masters enabled', () => {
    before(() => startService({
      bypass: {
        masters: {
          enabled: true,
        },
        'masters-dev': {
          enabled: true,
          provider: 'masters',
          baseUrl: 'https://simulation.masters.com',
          authPath: '/auth/services/id/validateToken',
          httpPoolOptions: {
            connections: 1,
            pipelining: 1,
          },
          httpClientOptions: {
            headersTimeout: 5000,
            bodyTimeout: 5000,
          },
          credentials: {
            local: {},
          },
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
      const reply = await msUsers.post({ json: msg });
      assert(reply.body.jwt);
    });

    it('signs in with valid session, existing user', async () => {
      const reply = await msUsers.post({ json: msg });
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
