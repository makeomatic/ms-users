const Promise = require('bluebird');
const { strict: assert } = require('assert');
const uuidv4 = require('uuid').v4;
const md5 = require('md5');
const { sign } = require('../../../../src/utils/signatures');
const { USERS_API_TOKENS } = require('../../../../src/constants');
const redisKey = require('../../../../src/utils/key');
const { startService, clearRedis, globalRegisterUser, globalAuthUser } = require('../../../config');

describe('#token.*', function activateSuite() {
  // actions supported by this
  const username = 'active@me.com';
  const createRoute = 'token.create';
  const eraseRoute = 'token.erase';
  const listRoute = 'token.list';
  const updateRoute = 'token.update';
  const getRoute = 'token.get';

  const verifyRoute = 'verify';

  before(startService);
  after(clearRedis);

  // registers user and pushes JWT to this.jwt
  before(globalRegisterUser(username));
  before(globalAuthUser(username));

  // simple iterator
  const iterator = Array.from({ length: 40 });
  let tokenHolder = [];

  // create 30 tokens
  describe('#token.create', function createTokenSuite() {
    // this is initial token
    it('registers one token', function test() {
      return this
        .users
        .dispatch(createRoute, { params: { username, name: 'initial token' } })
        .then((token) => {
          assert.equal(token.split('.').length, 3, 'invalid token format');
          assert.equal(token.split('.')[0], this.userId, 'invalid input hash');

          // creates tokens pool
          tokenHolder = [token];
        });
    });

    it('registers token with scope', async function test() {
      const token = await this.users.dispatch(createRoute, {
        params: {
          username,
          name: 'token with scope',
          type: 'sign',
          scopes: [{
            action: 'some',
            subject: 'read',
          }],
        },
      });
      tokenHolder.push(token);
      assert.equal(token.split('.').length, 3, 'invalid token format');
      assert.equal(token.split('.')[0], this.userId, 'invalid input hash');
    });

    it('#list returns token scope', async function test() {
      const tokens = await this.users.dispatch(listRoute, { params: { username } });
      const token = tokens.find((t) => !!t.scopes);

      assert.ok(token, 'token should exist');
      assert.deepStrictEqual(token.scopes, [{
        action: 'some',
        subject: 'read',
      }]);
    });

    it('registers more tokens', function test() {
      return Promise
        .map(iterator, (val, idx) => (
          this.users.dispatch(createRoute, { params: { username, name: `auto:${idx}` } })
        ))
        .then((tokens) => tokenHolder.push(...tokens));
    });
  });

  describe('#token.get', function getTokenSuite() {
    it('throws on missing token', async function test() {
      const promise = this.users.dispatch(getRoute, {
        params: {
          username,
          token: uuidv4(),
        },
      });

      assert.rejects(promise, /token not found/);
    });

    it('retrieves token data', async function test() {
      const tokenData = await this.users.dispatch(getRoute, {
        params: { username, token: tokenHolder[1].split('.')[1] },
      });

      assert.deepStrictEqual(tokenData.name, 'token with scope');
      assert.deepStrictEqual(tokenData.type, 'sign');
    });

    it('retrieves sensitive token data', async function test() {
      const tokenData = await this.users.dispatch(getRoute, {
        params: {
          username,
          token: tokenHolder[1].split('.')[1],
          sensitive: true,
        },
      });

      assert.deepStrictEqual(tokenData.name, 'token with scope');
      assert.deepStrictEqual(tokenData.raw, tokenHolder[1]);
    });
  });

  describe('#token.update', function updateTokenSuite() {
    it('throws on missing token', async function test() {
      const promise = this.users.dispatch(updateRoute, {
        params: {
          username,
          token: uuidv4(),
          scopes: [],
        },
      });

      assert.rejects(promise, /token not found/);
    });

    it('updates token scopes', async function test() {
      const token = tokenHolder[1];
      const tokenId = token.split('.')[1];

      const updateResult = await this.users.dispatch(updateRoute, {
        params: {
          username,
          token: tokenId,
          scopes: [{
            action: 'other',
            subject: 'manage',
          }],
        },
      });

      assert.strictEqual(updateResult, tokenId);

      const updatedToken = await this.users.dispatch(getRoute, {
        params: { username, token: tokenId },
      });

      assert.deepStrictEqual(updatedToken.scopes, [{
        action: 'other',
        subject: 'manage',
      }]);
    });
  });

  // ensure pagination works
  // we have a total of 41 tokens
  describe('#token.list', function listTokenSuite() {
    it('returns first page, new tokens first', function test() {
      return this.users.dispatch(listRoute, { params: { username } })
        .then((tokens) => {
          // default page size
          assert.equal(tokens.length, 20);

          // take first token, ensure it's newest
          const [token] = tokens;

          // auto:39
          assert.ok(/^auto:\d+$/, token.name);
          assert(token.userId);
          assert.equal(token.userId, this.userId);
          assert.ok(token.added);
          assert.ok(token.uuid);
        });
    });

    it('returns third page, two tokens', function test() {
      return this.users.dispatch(listRoute, { params: { username, page: 2 } })
        .then((tokens) => {
          // default page size
          assert.equal(tokens.length, 2);
          const [, token] = tokens;

          // check it's first token
          assert.equal(token.name, 'initial token');
          assert(token.userId);
          assert.equal(token.userId, this.userId);
          assert.ok(token.added);
          assert.ok(token.uuid);
        });
    });
  });

  // erase some tokens
  describe('#token.erase', function eraseTokenSuite() {
    it('removes all issued tokens but the initial one', function test() {
      return Promise.map(tokenHolder.slice(2), (token) => (
        this.users.dispatch(eraseRoute, { params: { username, token: token.split('.')[1] } })
      ));
    });

    it('returns first page, two tokens', function test() {
      return this.users.dispatch(listRoute, { params: { username } })
        .then((tokens) => {
          // default page size
          assert.equal(tokens.length, 2);
          const [, token] = tokens;

          // check it's first token
          assert.equal(token.name, 'initial token');
          assert(token.userId);
          assert.equal(token.userId, this.userId);
          assert.ok(token.added);
          assert.ok(token.uuid);
        });
    });
  });

  // ensure all tokens that were erase are inaccessible
  // rest of them can be used to authenticate
  describe('#verify', function verifyTokenSuite() {
    it('verifies that first token works', function test() {
      return this.users.dispatch(verifyRoute, { params: {
        token: tokenHolder[0],
        accessToken: true,
        audience: '*.localhost',
      } });
    });

    it('verifies that prefixed token denied', async function test() {
      await assert.rejects(
        this.users.dispatch(verifyRoute, { params: {
          token: tokenHolder[1],
          accessToken: true,
          audience: '*.localhost',
        } })
      );
    });

    it('verifies that all other tokens dont work', function test() {
      return Promise.map(tokenHolder.slice(2), (token) => (
        assert.rejects(this.users.dispatch(verifyRoute, { params: {
          token,
          accessToken: true,
          audience: '*.localhost',
        } }))
      ));
    });
  });
});

describe('legacy API tokens', function suit() {
  const username = 'test@ms-users.com';

  after('clean up redis', clearRedis);

  before('start service', function init() {
    return startService.call(this, { registrationLimits: { checkMX: false } });
  });

  before('register user', globalRegisterUser(username));

  before('create token', function createToken() {
    const uniqId = uuidv4();
    const hashedUsername = md5(username);
    const payload = `${hashedUsername}.${uniqId}`;
    const signature = sign.call(this.users, payload);
    const key = redisKey(USERS_API_TOKENS, payload);

    this.token = `${payload}.${signature}`;

    return this.users.redis.hmset(key, { username, name: 'token for test', uuid: uniqId });
  });

  it('should be able to verify', function test() {
    return this
      .users
      .dispatch('verify', { params: {
        token: this.token,
        accessToken: true,
        audience: '*.localhost',
      } })
      .then((response) => {
        assert.equal(username, response.metadata['*.localhost'].username);
      });
  });
});
