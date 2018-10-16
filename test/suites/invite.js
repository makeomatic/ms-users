const { inspectPromise } = require('@makeomatic/deploy');
const assert = require('assert');

describe('#invite', function registerSuite() {
  before(global.startService);
  after(global.clearRedis);

  const email = 'v@yandex.ru';

  it('must reject invalid input', function test() {
    return this
      .dispatch('users.invite', {
        email,
        ctx: {
          firstName: 'Alex',
          lastName: 'Bon',
        },
        metadata: {
          not_namespace_prefix: [],
        },
      })
      .reflect()
      .then(inspectPromise(false))
      .then((err) => {
        assert.equal(err.name, 'HttpStatusError');
      });
  });

  it('must be able to create invitation', function test() {
    return this
      .dispatch('users.invite', {
        email,
        ctx: {
          firstName: 'Alex',
          lastName: 'Bon',
        },
        metadata: {
          '*.localhost': {
            plan: 'premium',
            vip: true,
          },
        },
      })
      .reflect()
      .then(inspectPromise())
      .then((result) => {
        assert.ok(result.queued);
        assert.ok(result.context.token);
        assert.ok(result.context.qs);
        assert.ok(result.context.link);
        this.invitationToken = result.context.token.secret;
      });
  });

  it('must be able to register with a valid invitation', function test() {
    return this
      .dispatch('users.register', {
        username: email,
        password: '123',
        inviteToken: this.invitationToken,
        audience: '*.localhost',
      })
      .reflect()
      .then(inspectPromise())
      .then((result) => {
        assert.ok(result.jwt);
        assert.ok(result.user.id);
        assert.ok(result.user.metadata['*.localhost'].created);
        assert.equal(result.user.metadata['*.localhost'].username, email);
        assert.equal(result.user.metadata['*.localhost'].plan, 'premium');
        assert.equal(result.user.metadata['*.localhost'].vip, true);
      });
  });

  it('must reject valid invitation for different username', function test() {
    return this
      .dispatch('users.register', {
        username: 'abnormal@yandex.ru',
        password: '123',
        inviteToken: this.invitationToken,
        audience: '*.localhost',
      })
      .reflect()
      .then(inspectPromise(false))
      .then((err) => {
        assert.equal(err.name, 'AssertionError [ERR_ASSERTION]');
        assert.equal(err.message, `Sanity check failed for "id" failed: "abnormal@yandex.ru" vs "${email}"`);
      });
  });

  it('must accept valid invitation for a different username with a special param, but then reject because it was already used', function test() {
    return this
      .dispatch('users.register', {
        username: 'abnormal@yandex.ru',
        password: '123',
        inviteToken: this.invitationToken,
        audience: '*.localhost',
        anyUsername: true,
      })
      .reflect()
      .then(inspectPromise(false))
      .then((err) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.message, 'Invitation has expired or already been used');
      });
  });
});
