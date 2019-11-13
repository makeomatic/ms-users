const { inspectPromise } = require('@makeomatic/deploy');
const { expect } = require('chai');
const simpleDispatcher = require('./../helpers/simple-dispatcher');

describe('#updateMetadata', function getMetadataSuite() {
  const username = 'v@makeomatic.ru';
  const audience = '*.localhost';
  const extra = 'extra.localhost';

  beforeEach(global.startService);
  afterEach(global.clearRedis);

  beforeEach(function pretest() {
    return simpleDispatcher(this.users.router)('users.register', { username, password: '123', audience })
      .tap(({ user }) => { this.userId = user.id; });
  });

  it('must reject updating metadata on a non-existing user', function test() {
    return simpleDispatcher(this.users.router)('users.updateMetadata', { username: 'ok google', audience, metadata: { $remove: ['test'] } })
      .reflect()
      .then(inspectPromise(false))
      .then((getMetadata) => {
        expect(getMetadata.name).to.be.eq('HttpStatusError');
        expect(getMetadata.statusCode).to.be.eq(404);
      });
  });

  it('must be able to add metadata for a single audience of an existing user', function test() {
    return simpleDispatcher(this.users.router)('users.updateMetadata', { username, audience, metadata: { $set: { x: 10 } } })
      .reflect()
      .then(inspectPromise());
  });

  it('must be able to remove metadata for a single audience of an existing user', function test() {
    return simpleDispatcher(this.users.router)('users.updateMetadata', { username, audience, metadata: { $remove: ['x'] } })
      .reflect()
      .then(inspectPromise())
      .then((data) => {
        expect(data.$remove).to.be.eq(0);
      });
  });

  it('rejects on mismatch of audience & metadata arrays', function test() {
    return simpleDispatcher(this.users.router)('users.updateMetadata', {
      username,
      audience: [audience],
      metadata: [{ $set: { x: 10 } }, { $remove: ['x'] }],
    }).reflect()
      .then(inspectPromise(false));
  });

  it('must be able to perform batch operations for multiple audiences of an existing user', function test() {
    return simpleDispatcher(this.users.router)('users.updateMetadata', {
      username,
      audience: [
        audience,
        extra,
      ],
      metadata: [
        {
          $set: {
            x: 10,
          },
          $incr: {
            b: 2,
          },
          $remove: ['c'],
        },
        {
          $incr: {
            b: 3,
          },
        },
      ],
    }).reflect()
      .then(inspectPromise())
      .then((data) => {
        const [mainData, extraData] = data;
        expect(mainData.$set).to.be.eq('OK');
        expect(mainData.$incr.b).to.be.eq(2);
        expect(extraData.$incr.b).to.be.eq(3);
      });
  });

  it('must be able to run dynamic scripts', async function test() {
    const params = {
      username,
      audience: [audience, extra],
      script: {
        balance: {
          lua: 'return {KEYS[1],KEYS[2],ARGV[1]}',
          argv: ['nom-nom'],
        },
      },
    };

    const updated = await this.dispatch('users.updateMetadata', params);

    expect(updated.balance).to.be.deep.eq([
      `{ms-users}${this.userId}!metadata!${audience}`,
      `{ms-users}${this.userId}!metadata!${extra}`,
      'nom-nom',
    ]);
  });

  describe('tracks audienceList', function audienceTrackSuite() {
    beforeEach(async function updateUser() {
      const params = {
        username,
        audience: [
          audience,
          '*.extra',
        ],
        metadata: [
          {
            $set: {
              x: 10,
              b: 12,
              c: 'cval',
            },
          }, {
            $set: {
              x: 20,
              b: 22,
              c: 'xval',
            },
          },
        ],
      };

      await this.dispatch('users.updateMetadata', params);
    });
    it('adds audience', async function test() {
      const audiencesList = await this.users.redis.smembers(`${this.userId}!users-audiences`);
      expect(audiencesList).to.include.members(['*.localhost', '*.extra']);
    });

    it('deletes audience when no metadata left', async function test() {
      const deleteParams = {
        username,
        audience: ['*.extra'],
        metadata: [
          {
            $rem: ['x', 'b', 'c'],
          },
        ],
      };
      await this.dispatch('users.updateMetadata', deleteParams);
      const audiencesList = await this.users.redis.smembers(`${this.userId}!users-audiences`);
      expect(audiencesList).to.include.members(['*.localhost']);
    });
  });
});
