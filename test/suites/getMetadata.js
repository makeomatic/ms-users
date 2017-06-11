const { inspectPromise } = require('@makeomatic/deploy');
const assert = require('assert');

describe('#getMetadata', function getMetadataSuite() {
  beforeEach(global.startService);
  afterEach(global.clearRedis);

  it('must reject to return metadata on a non-existing username', function test() {
    const { defaultAudience: audience } = this.users._config.jwt;

    return this.dispatch('users.getMetadata', { username: 'noob', audience })
      .reflect()
      .then(inspectPromise(false))
      .then((error) => {
        assert.equal(error.name, 'HttpStatusError');
        assert.equal(error.statusCode, 404);
      });
  });

  describe('existing user', function suite() {
    const username = 'v@makeomatic.ru';
    const usernameB = 'b@makeomatic.ru';
    const audience = '*.localhost';

    beforeEach(function pretest() {
      return this.dispatch('users.register', {
        username, password: '123', audience, metadata: { name: { q: 'verynicedata' } },
      });
    });

    beforeEach(function pretest() {
      return this.dispatch('users.register', {
        username: usernameB, password: '123', audience, metadata: { name: 'boredom' },
      });
    });

    beforeEach(function pretest() {
      return this.dispatch('users.updateMetadata', {
        username,
        audience: ['matic.ninja', audience],
        metadata: [
          { $set: { iat: 10 } },
          { $remove: ['created'] },
        ],
      });
    });

    it('must return metadata for a default audience', function test() {
      return this.dispatch('users.getMetadata', { username, audience })
        .reflect()
        .then(inspectPromise())
        .then((getMetadata) => {
          assert.deepEqual(getMetadata[audience].name, {
            q: 'verynicedata',
          });

          assert.equal(getMetadata[audience].username, username);
        });
    });

    it('must return metadata for default and passed audiences', function test() {
      return this.dispatch('users.getMetadata', { username, audience: [audience, 'matic.ninja'] })
        .reflect()
        .then(inspectPromise())
        .then((getMetadata) => {
          assert.deepEqual(getMetadata, {
            [audience]: {
              name: {
                q: 'verynicedata',
              },
              username,
            },
            'matic.ninja': {
              iat: 10,
            },
          });
        });
    });

    it('must return partial response for default and passed audiences', function test() {
      return this.dispatch('users.getMetadata', {
        username,
        audience: [audience, 'matic.ninja'],
        fields: {
          [audience]: ['username'],
          'matic.ninja': ['iat'],
        },
      })
      .reflect()
      .then(inspectPromise())
      .then((getMetadata) => {
        assert.deepEqual(getMetadata, {
          [audience]: {
            username,
          },
          'matic.ninja': {
            iat: 10,
          },
        });
      });
    });

    it('must return metadata for multiple users', function test() {
      return this.dispatch('users.getMetadata', {
        username: [username, usernameB],
        audience,
        fields: {
          [audience]: ['username'],
        },
      })
      .reflect()
      .then(inspectPromise())
      .then((meta) => {
        assert.ok(Array.isArray(meta));
        assert.ok(meta.length === 2);
        assert.deepEqual(meta, [{
          [audience]: {
            username,
          },
        }, {
          [audience]: {
            username: usernameB,
          },
        }]);
      });
    });
  });
});
