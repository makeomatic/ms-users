const { expect } = require('chai');
const { strict: assert } = require('assert');

describe('#updateMetadata', function getMetadataSuite() {
  const username = 'v@makeomatic.ru';
  const audience = '*.localhost';
  const extra = 'extra.localhost';

  beforeEach(global.startService);
  afterEach(global.clearRedis);

  beforeEach(async function pretest() {
    const { user } = await this.users.dispatch('register', { params: { username, password: '123', audience } });
    this.userId = user.id;
  });

  it('must reject updating metadata on a non-existing user', async function test() {
    const params = { username: 'ok google', audience, metadata: { $remove: ['test'] } };
    await assert.rejects(this.users.dispatch('updateMetadata', { params }), {
      name: 'HttpStatusError',
      statusCode: 404,
    });
  });

  it('must be able to add metadata for a single audience of an existing user', async function test() {
    await this.users.dispatch('updateMetadata', { params: { username, audience, metadata: { $set: { x: 10 } } } });
  });

  it('must be able to remove metadata for a single audience of an existing user', async function test() {
    await this.users.dispatch('updateMetadata', { params: { username, audience, metadata: { $remove: ['x'] } } });
  });

  it('rejects on mismatch of audience & metadata arrays', async function test() {
    const params = { username,
      audience: [audience],
      metadata: [{ $set: { x: 10 } }, { $remove: ['x'] }],
    };
    await assert.rejects(this.users.dispatch('updateMetadata', { params }), {
      name: 'HttpStatusError',
      statusCode: 400,
    });
  });

  it('must be able to perform batch operations for multiple audiences of an existing user', async function test() {
    await this.users.dispatch('updateMetadata', { params: {
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
        },
        {
          $incr: {
            b: 3,
          },
        },
      ],
    } });
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

    const reply = await this.users.dispatch('updateMetadata', { params });
    expect(reply.balance).to.be.deep.eq([
      `{ms-users}${this.userId}!metadata!${audience}`,
      `{ms-users}${this.userId}!metadata!${extra}`,
      'nom-nom',
    ]);
  });
});
