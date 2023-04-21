/* global startService, clearRedis */
const { strict: assert } = require('assert');

describe('/bypass/streamlayer', function verifySuite() {
  const userWithValidPassword = { username: 'v@makeomatic.ru', password: 'nicepassword1', audience: '*.localhost' };
  const account = 'streamlayer';

  before('start', async () => {
    await startService.call(this, {
      jwt: {
        stateless: {
          enabled: true,
          fields: ['username', 'extra', 'internal'],
        },
      },
      bypass: {
        internal: {
          enabled: true,
          provider: 'streamlayer',
        },
      },
    });
  });

  after(clearRedis.bind(this));
  afterEach(clearRedis.bind(this, true));

  before(async () => {
    await this.users.dispatch('register', { params: userWithValidPassword });

    const { jwt } = await this.users.dispatch('login', { params: userWithValidPassword });

    this.baseJwt = jwt;
  });

  it('authenticate user with legacy JWT and assing new JWT', async () => {
    const repsonse = await this.users.dispatch('auth-bypass', { params: {
      schema: `internal:${account}`,
      userKey: this.baseJwt,
    } });

    assert(repsonse.jwt);
    assert(repsonse.user.metadata[userWithValidPassword.audience]);
    assert(repsonse.user.metadata[userWithValidPassword.audience][account]);
    assert.equal(repsonse.user.metadata[userWithValidPassword.audience][account].id, userWithValidPassword.username);
  });
});
