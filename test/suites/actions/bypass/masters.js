const assert = require('node:assert/strict');
const { Agent, setGlobalDispatcher, fetch } = require('undici');
const { startService, clearRedis } = require('../../../config');

const agent = new Agent({
  connect: {
    rejectUnauthorized: false,
  },
});

setGlobalDispatcher(agent);

const headers = {
  'Content-Type': 'application/json',
};
const options = {
  // agent: httpsAgent,
  method: 'POST',
  headers,
};
const bypassUrl = 'https://ms-users.local/users/auth-bypass';
const audience = '*.localhost';
const extraAudience = 'secret-meta';

const t = process.env.SKIP_MASTERS === 'true'
  ? describe.skip
  : describe;

t('/bypass/masters', function verifySuite() {
  const pwd = process.env.MASTERS_PROFILE_PASSWORD;
  const username = process.env.MASTERS_PROFILE_USERNAME;
  let msg;
  let profile;

  before(async () => {
    const res = await fetch(process.env.MASTERS_SIMULATION_API, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        provider: 'masters',
        username,
        password: pwd,
      }),
    });

    assert(res.status === 200, `failed to login to masters simulation: ${res.statusText}`);
    profile = await res.json();

    msg = {
      schema: 'masters:local',
      userKey: profile.token,
    };
  });

  t('masters disabled', () => {
    before(() => startService());
    after(() => clearRedis());

    it('validates its off', async () => {
      const res = await fetch(bypassUrl, { ...options, body: JSON.stringify(msg) });
      const body = await res.json();

      assert.deepStrictEqual(body, {
        statusCode: 412,
        error: 'Precondition Failed',
        message: 'masters auth disabled',
        name: 'HttpStatusError',
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
          additionalMeta: {
            [extraAudience]: ['tinodeUserId'],
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
      const reply = await fetch(bypassUrl, { ...options, body: JSON.stringify(msg) });
      assert(reply.ok);
      const body = await reply.json();
      assert(body.jwt);
      assert.ifError(body.user.metadata[audience].email);
      assert.ifError(body.user.metadata[extraAudience]); // must not be present - because it's a register call
    });

    it('signs in with valid session, existing user', async () => {
      const reply = await fetch(bypassUrl, { ...options, body: JSON.stringify(msg) });
      assert(reply.ok);
      const body = await reply.json();
      assert(body.jwt);
      assert.ifError(body.user.metadata[audience].email);
      assert.ifError(body.user.metadata[extraAudience]); // must not be present - because it wasn't set yet

      const internalUsername = body.user.id;

      // assign metadata now
      await this.users.dispatch('updateMetadata', {
        params: {
          username: internalUsername,
          audience: extraAudience,
          metadata: {
            $set: {
              tinodeUserId: 'super',
              tinodeUserIdExtraField: 'must not be returned',
            },
          },
        },
      });

      const replyTwo = await fetch(bypassUrl, { ...options, body: JSON.stringify(msg) });
      assert(replyTwo.ok);
      const bodyTwo = await reply.json();
      assert(bodyTwo.jwt);
      assert.ifError(bodyTwo.user.metadata[audience].email);
      assert(bodyTwo.user.metadata[extraAudience]); // it was set earlier, must be present
      assert.equal(bodyTwo.user.metadata[extraAudience].tinodeUserId, 'super');
      assert.ifError(bodyTwo.user.metadata[extraAudience].tinodeUserIdExtraField);
    });

    it('rejects on invalid session uid', async () => {
      const res = await fetch(bypassUrl, { ...options, body: JSON.stringify({ ...msg, userKey: 'invalid' }) });
      const body = await res.json();

      assert.deepStrictEqual(body, {
        statusCode: 403,
        error: 'Forbidden',
        message: 'invalid token',
        name: 'HttpStatusError',
      });
    });
  });
});
