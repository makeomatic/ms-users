const { expect } = require('chai');
const { RedisError } = require('common-errors').data;

const UpdateMetaData = require('../../../../../src/utils/updateMetadata');
// direct access test suite. Validator doesn't allow us to use incorrect arguments
describe('#updateMetadata LUA script', function updateMetadataLuaSuite() {
  const username = 'v@makeomatic.ru';
  const audience = '*.localhost';
  let updateMetadata;

  beforeEach(global.startService.bind(this));
  afterEach(global.clearRedis.bind(this));

  beforeEach(async () => {
    await this.dispatch('users.register', { username, password: '123', audience })
      .tap(({ user }) => { this.userId = user.id; });
  });


  beforeEach('setUserProps', async () => {
    const params = {
      userId: this.userId,
      audience: [
        audience,
      ],
      metadata: [
        {
          $set: {
            x: 10,
            b: 12,
            c: 'cval',
          },
        },
      ],
    };

    updateMetadata = UpdateMetaData.bind(this.users);
    await updateMetadata(params);
  });

  // should  error if one of the commands failed to run
  // BUT other commands must be executed
  it('behaves like Redis pipeline using MetaOperations', async () => {
    const params = {
      userId: this.userId,
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
      await updateMetadata(params);
    } catch (e) {
      updateError = e;
    }
    expect(updateError).to.be.an.instanceof(RedisError, 'should throw error');

    const redisUserMetaKey = `${this.userId}!metadata!${audience}`;
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
      userId: this.userId,
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
      await updateMetadata(params);
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
