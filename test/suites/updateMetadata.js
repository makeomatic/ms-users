const { inspectPromise } = require('@makeomatic/deploy');
const { expect } = require('chai');
const simpleDispatcher = require('./../helpers/simpleDispatcher');

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
        console.log(data);
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
        console.log(data);
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

  it('must be able to run dynamic scripts / default namespace available', async function test() {
    const lua = `
      local t = {}
      table.insert(t, "foo")
      local jsonDec = cjson.decode('{"bar": 1}')
      local typeCheck = type(t)
      redis.call("SET", "fookey", 777);
      return {jsonDec.bar, redis.call("TIME"), redis.call("GET", "fookey"), typeCheck, unpack(t)}
    `;

    const params = {
      username,
      audience: [audience],
      script: {
        check: {
          lua,
          argv: ['nom-nom'],
        },
      },
    };
    const updated = await this.dispatch('users.updateMetadata', params);
    const [jsonVal, redisTime, keyValue] = updated.check;
    expect(jsonVal).to.be.eq(1);
    expect(redisTime).to.be.an('array');
    expect(keyValue).to.be.eq('777');
  });

  // direct access test suite. Validator doesn't allow us to use incorrect arguments
  describe('it must behave like js updateMetadata', function mimicTest() {
    const util = require('util');
    const { RedisError } = require('common-errors').data;
    let updateMetadata;

    beforeEach('setUserProps', async function setUserProps() {
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

      updateMetadata = require('../../src/utils/updateMetadata.js').bind(this.users);
      await updateMetadata(params);
    });

    // should  error if one of the commands failed to run
    // BUT other commands must be executed
    it('update using changesets behaves like pipeline', async function test() {
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
      console.log(util.inspect(updateError, { depth: null }));

      expect(updateError).to.be.an.instanceof(RedisError, 'should throw error');

      const redisUserMetaKey = `${this.userId}!metadata!${audience}`;
      const userData = await this.users.redis.hgetall(redisUserMetaKey);

      expect(userData).to.include({
        x: '10',
        b: '14',
      });

      expect(userData).to.not.include({
        c: 'cval',
      });
    });

    it('update executes all LUA scripts despite on the script error', async function test() {
      const luaScript = `
        redis.call("SET", '{ms-users}myTestKey', 777)
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
        },
      };

      let updateError;

      try {
        await updateMetadata(params);
      } catch (e) {
        updateError = e;
      }
      console.log(util.inspect(updateError, { depth: null }));

      expect(updateError).to.be.an.instanceof(RedisError, 'should throw error');

      const testKeyContents = await this.users.redis.get('myTestKey');
      expect(testKeyContents).to.be.equal('777');
    });
  });

});
