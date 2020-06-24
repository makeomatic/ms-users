const assert = require('assert');
const got = require('got');

const msUsers = got.extend({
  prefixUrl: 'http://ms-users.local/users/relay/tbits',
  responseType: 'json',
  https: { rejectUnauthorized: false },
});

const tbitsAPI = got.extend({
  prefixUrl: 'https://fanxp.tradablebits.com/api/auth',
  responseType: 'json',
  resolveBodyOnly: true,
  method: 'post',
});

describe('/relay/tbits', function verifySuite() {
  const username = 'microfleet@makeomatic.ca';
  const password = 'Demopassword1';
  const accountId = '7177497';
  let sessionUid;
  let pristine;
  let second;

  before(async () => {
    const requestId = await tbitsAPI('request', { json: { account_id: accountId } });
    const resp = await tbitsAPI('login', { json: { request_uid: requestId, login_name: username, password } });
    if (resp.terms_required) {
      await tbitsAPI('legal_accept', { json: { request_uid: requestId, legal_terms: true, legal_privacy: true } });
    }
    sessionUid = await tbitsAPI('session', { json: { request_uid: requestId, challenge_uid: resp.challenge_uid } });
  });

  describe('tbits disabled', () => {
    before(() => global.startService());
    after(() => global.clearRedis());

    it('validates its off', async () => {
      await assert.rejects(msUsers.post({ json: { sessionUid } }), (e) => {
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
    before(() => global.startService({ tbits: { enabled: true } }));
    after(() => global.clearRedis());

    it('rejects on invalidd session uid', async () => {
      await assert.rejects(msUsers.post({ json: { sessionUid: 'invalid' } }), (e) => {
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
      pristine = await msUsers.post({ json: { sessionUid } });
      console.info('%j', pristine.body);
    });

    it('signs in with valid session, existing user', async () => {
      second = await msUsers.post({ json: { sessionUid } });
      console.info('%j', second.body);
    });
  });
});
