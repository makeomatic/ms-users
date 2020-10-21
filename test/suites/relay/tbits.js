const assert = require('assert');
const got = require('got');

const msUsers = got.extend({
  prefixUrl: 'http://ms-users.local/users/relay/tbits',
  responseType: 'json',
  https: { rejectUnauthorized: false },
});

const tbitsAPI = got.extend({
  prefixUrl: 'https://tradablebits.com/api/v1',
  responseType: 'json',
  resolveBodyOnly: true,
  method: 'post',
});

describe('/relay/tbits', function verifySuite() {
  const username = 'microfleet@makeomatic.ca';
  const password = 'Demopassword1';
  const apiKey = process.env.TBITS_API_KEY;
  let sessionUid;
  let pristine;
  let second;

  before(async () => {
    const form = {
      password,
      email: username,
      network: 'email',
      api_key: apiKey,
    };

    try {
      const result = await tbitsAPI('sessions/connect', { form });
      console.log('result', result);
      sessionUid = result.session_uid;
    } catch (e) {
      console.log(e);
      throw e;
    }
  });

  describe('tbits disabled', () => {
    before(() => global.startService());
    after(() => global.clearRedis());

    it('validates its off', async () => {
      await assert.rejects(msUsers.post({ json: { apiKey, sessionUid } }), (e) => {
        assert.deepStrictEqual(e.response.body, {
          statusCode: 412,
          error: 'Precondition Failed',
          message: 'tbits relay auth disabled',
          name: 'HttpStatusError',
        });
        return true;
      });
    });
  });

  describe('tbits enabled', () => {
    before(() => global.startService({
      tbits: {
        enabled: true,
      },
      validation: {
        templates: {
          register: 'UNKNOWN',
        },
      },
    }));
    after(() => global.clearRedis());

    it('rejects on invalidd session uid', async () => {
      await assert.rejects(msUsers.post({ json: { apiKey, sessionUid: 'invalid' } }), (e) => {
        assert.deepStrictEqual(e.response.body, {
          statusCode: 403,
          error: 'Forbidden',
          message: 'invalid token',
          name: 'HttpStatusError',
        });
        return true;
      });
    });

    it('signs in with valid session, non-existent user', async () => {
      pristine = await msUsers.post({ json: { apiKey, sessionUid } });
      console.info('%j', pristine.body);
    });

    it('signs in with valid session, existing user', async () => {
      second = await msUsers.post({ json: { apiKey, sessionUid } });
      console.info('%j', second.body);
    });
  });
});
