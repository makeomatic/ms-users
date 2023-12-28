const assert = require('node:assert/strict');
const { startService, clearRedis } = require('../../../config');

describe('/bypass/streamlayer', function bypassStreamlayer() {
  const userWithValidPassword = { username: 'v@makeomatic.ru', password: 'nicepassword1', audience: '*.localhost' };
  const account = 'streamlayer';
  const schema = 'streamlayer';

  before('start', async () => {
    await startService.call(this, {
      jwt: {
        stateless: {
          enabled: true,
          fields: ['username', 'extra', 'streamlayer'],
        },
      },
      bypass: {
        streamlayer: {
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
      schema: `${schema}:${account}`,
      userKey: this.baseJwt,
    } });

    assert(repsonse.jwt);
    assert(repsonse.user.metadata[userWithValidPassword.audience]);
    assert(repsonse.user.metadata[userWithValidPassword.audience][account]);
    assert.equal(repsonse.user.metadata[userWithValidPassword.audience][account].id, userWithValidPassword.username);
  });

  it('should not authenticate user with incorrect schema', async () => {
    const notExistsSchema = 'internal';

    const repsonse = this.users.dispatch('auth-bypass', { params: {
      schema: `${notExistsSchema}:${account}`,
      userKey: this.baseJwt,
    } });

    await assert.rejects(repsonse, {
      name: 'HttpStatusError',
      statusCode: 412,
    });
  });
});
