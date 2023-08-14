const { strict: assert } = require('assert');
const { startService, clearRedis } = require('../../../config');

describe('/bypass/kaizen', function bypassKaizen() {
  const kaizenUser = { username: 'FooBar', audience: '*.localhost', userId: '12341234' };
  const account = kaizenUser.username;
  const schema = 'kaizen';

  const action = 'auth-bypass'

  let userId;
  let username;

  before('start', async () => {
    await startService.call(this, {
      jwt: {
        stateless: {
          enabled: true,
          fields: ['username', 'extra', 'kaizen'],
        },
      },
      bypass: {
        [schema]: {
          enabled: true,
          provider: schema,
        },
      },
    });
  });

  after(clearRedis.bind(this));

  it('register user', async () => {
    const repsonse = await this.users.dispatch(action, { params: {
      schema: `${schema}:${account}`,
      userKey: kaizenUser.userId,
    } });
 
    assert(repsonse.jwt);
    assert(repsonse.user.metadata);

    const { metadata } = repsonse.user

    assert(metadata[kaizenUser.audience]);
    assert(metadata[kaizenUser.audience].id);
    assert.equal(metadata[kaizenUser.audience].name, kaizenUser.username);
    assert.equal(metadata[kaizenUser.audience].username, `${schema}/${kaizenUser.userId}`);

    userId = metadata[kaizenUser.audience].id
    username = metadata[kaizenUser.audience].username
  });

  it('should login already registred user', async () => {
    const repsonse = await this.users.dispatch(action, { params: {
      schema: `${schema}:${account}`,
      userKey: kaizenUser.userId,
    } });
 
    assert(repsonse.jwt);
    assert(repsonse.user.metadata[kaizenUser.audience]);
    assert(repsonse.user.metadata[kaizenUser.audience].id);
    assert.equal(repsonse.user.metadata[kaizenUser.audience].id, userId);
    assert.equal(repsonse.user.metadata[kaizenUser.audience].username, username);
  });
});
