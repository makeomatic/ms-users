const { expect } = require('chai');
const { RedisError } = require('common-errors').data;

const UpdateMetaData = require('../../../../../src/utils/metadata/redis/update-metadata');
// direct access test suite. Validator doesn't allow us to use incorrect arguments
describe('#updateMetadata LUA script', function updateMetadataLuaSuite() {
  const id = '7777777777777';
  const audience = '*.localhost';
  let metaUpdater;

  before(global.startService.bind(this));
  afterEach(global.clearRedis.bind(this, true));
  after(global.clearRedis.bind(this));

  beforeEach('setUserProps', async () => {
    const params = {
      id,
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

    metaUpdater = new UpdateMetaData(this.users.redis, '{id}:testMeta:{audience}', '{id}:audience');
    await metaUpdater.update(params);
  });

  it('sets meta', async () => {
    const redisUserMetaKey = `${id}:testMeta:${audience}`;
    const userDataAudience = await this.users.redis.hgetall(redisUserMetaKey);
    expect(userDataAudience).to.be.deep.equal({ x: '10', c: '"cval"', b: '12' });

    const userDataExtraAudience = await this.users.redis.hgetall(`${id}:testMeta:*.extra`);
    expect(userDataExtraAudience).to.be.deep.equal({ x: '20', c: '"xval"', b: '22' });
  });

  it('tracks audienceList', async () => {
    const audiencesList = await this.users.redis.smembers(`${id}:audience`);
    expect(audiencesList).to.be.deep.equal(['*.localhost', '*.extra']);
  });

  it('tracks audienceList after remove', async () => {
    await metaUpdater.update({
      id,
      audience: [
        '*.extra',
      ],
      metadata: [
        {
          $remove: ['x', 'c', 'b'],
        },
      ],
    });

    const audiencesList = await this.users.redis.smembers(`${id}:audience`);
    expect(audiencesList).to.be.deep.equal(['*.localhost']);
  });

  // should  error if one of the commands failed to run
  // BUT other commands must be executed
  it('behaves like Redis pipeline using MetaOperations', async () => {
    const params = {
      id,
      audience: [
        audience,
      ],
      metadata: [
        {
          $set: {
            x: 10,
            y: null,
          },
          $incr: {
            b: 2,
            d: 'asf',
          },
          $remove: ['c'],
        },
      ],
    };

    let updateError;
    try {
      await metaUpdater.update(params);
    } catch (e) {
      updateError = e;
    }
    expect(updateError).to.be.an.instanceof(RedisError, 'should throw error');

    const redisUserMetaKey = `${id}:testMeta:${audience}`;
    const userData = await this.users.redis.hgetall(redisUserMetaKey);

    expect(userData).to.include({ x: '10', b: '14' });
    expect(userData).to.not.include({ c: 'cval' });
  });

  it('executes LUA scripts despite on some of the scripts error', async () => {
    const luaScript = `
      redis.call("SET", '{ms-users}myTestKey' .. ARGV[1], ARGV[1])
      return ARGV[1]
    `;

    const params = {
      id,
      audience: [audience],
      script: {
        firstScript: {
          lua: 'return foo',
        },
        secondScript: {
          lua: luaScript,
          argv: ['777'],
        },
        thirdScript: {
          lua: luaScript,
          argv: ['888'],
        },
      },
    };

    let updateError;

    try {
      await metaUpdater.update(params);
    } catch (e) {
      updateError = e;
    }

    expect(updateError).to.be.an.instanceof(RedisError, 'should throw error');

    const testKeyContents = await this.users.redis.get('myTestKey777');
    expect(testKeyContents).to.be.equal('777');

    const secondTestKeyContents = await this.users.redis.get('myTestKey888');
    expect(secondTestKeyContents).to.be.equal('888');
  });
});
