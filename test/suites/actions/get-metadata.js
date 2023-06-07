const { strict: assert } = require('assert');
const { startService, clearRedis } = require('../../config');

describe('#getMetadata', function getMetadataSuite() {
  beforeEach(startService);
  afterEach(clearRedis);

  it('must reject to return metadata on a non-existing username', async function test() {
    const { defaultAudience: audience } = this.users.config.jwt;

    await assert.rejects(this.users.dispatch('getMetadata', { params: { username: 'noob', audience } }), {
      name: 'HttpStatusError',
      statusCode: 404,
    });
  });

  describe('existing user', function suite() {
    const username = 'v@makeomatic.ru';
    const usernameB = 'b@makeomatic.ru';
    const audience = '*.localhost';

    beforeEach(function pretest() {
      return this
        .users
        .dispatch('register', { params: {
          username, password: '123', audience, metadata: { name: { q: 'verynicedata' } },
        } })
        .then(({ user }) => {
          this.firstUserId = user.id;
        });
    });

    beforeEach(function pretest() {
      return this
        .users
        .dispatch('register', { params: {
          username: usernameB, password: '123', audience, metadata: { name: 'boredom' },
        } })
        .then(({ user }) => {
          this.secondUserId = user.id;
        });
    });

    beforeEach(function pretest() {
      return this.users.dispatch('updateMetadata', { params: {
        username,
        audience: ['matic.ninja', audience],
        metadata: [
          { $set: { iat: 10 } },
          { $remove: ['created'] },
        ],
      } });
    });

    it('must return metadata for a default audience', async function test() {
      const meta = await this.users.dispatch('getMetadata', { params: { username, audience } });

      assert.deepEqual(meta[audience].name, {
        q: 'verynicedata',
      });

      assert.equal(meta[audience].username, username);
    });

    it('must return metadata for default and passed audiences', async function test() {
      const meta = await this.users.dispatch('getMetadata', { params: {
        username,
        audience: [audience, 'matic.ninja'],
      } });

      assert.deepEqual(meta[audience].name, {
        q: 'verynicedata',
      });

      assert.equal(meta[audience].username, username);
      assert.equal(meta[audience].id, this.firstUserId);
      assert.deepEqual(meta['matic.ninja'], { iat: 10 });
    });

    it('must return partial response for default and passed audiences', async function test() {
      const meta = await this.users.dispatch('getMetadata', { params: {
        username,
        audience: [audience, 'matic.ninja'],
        fields: {
          [audience]: ['username'],
          'matic.ninja': ['iat'],
        },
      } });

      assert.equal(meta[audience].username, username);
      assert.deepEqual(meta['matic.ninja'], {
        iat: 10,
      });
    });

    it('must return metadata for multiple users', async function test() {
      const meta = await this.users.dispatch('getMetadata', { params: {
        username: [username, usernameB],
        audience,
        fields: {
          [audience]: ['username'],
        },
      } });

      assert(Array.isArray(meta));
      assert(meta.length === 2);
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
