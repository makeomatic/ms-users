/* global globalRegisterUser, globalAuthUser */
const Promise = require('bluebird');
const { strict: assert } = require('assert');
const uuidv4 = require('uuid').v4;
const md5 = require('md5');
const { sign } = require('../../../../src/utils/signatures');
const { USERS_API_TOKENS } = require('../../../../src/constants');
const redisKey = require('../../../../src/utils/key');

describe('#token.*', function activateSuite() {
  // actions supported by this
  const username = 'active@me.com';
  const createRoute = 'token.create';
  const eraseRoute = 'token.erase';
  const listRoute = 'token.list';
  const verifyRoute = 'verify';

  before(global.startService);
  after(global.clearRedis);

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

    it('registers more tokens', function test() {
      return Promise
        .map(iterator, (val, idx) => (
          this.users.dispatch(createRoute, { params: { username, name: `auto:${idx}` } })
        ))
        .then((tokens) => tokenHolder.push(...tokens));
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
          console.debug('== tokens', tokens);
          // take first token, ensure it's newest
          const [token] = tokens;

          // auto:39
          assert.ok(/^auto:\d+$/, token.name);
          assert(token.userId);
          assert.equal(token.userId, this.userId);
          assert.ok(token.added);
          assert.ok(token.uuid);
          assert.equal(Object.keys(token).length, 5);
        });
    });

    it('returns third page, one token', function test() {
      return this.users.dispatch(listRoute, { params: { username, page: 2 } })
        .then((tokens) => {
          // default page size
          assert.equal(tokens.length, 1);
          const [token] = tokens;

          // check it's first token
          assert.equal(token.name, 'initial token');
          assert(token.userId);
          assert.equal(token.userId, this.userId);
          assert.ok(token.added);
          assert.ok(token.uuid);
          assert.equal(Object.keys(token).length, 5);
        });
    });
  });

  // erase some tokens
  describe('#token.erase', function eraseTokenSuite() {
    it('removes all issued tokens but the initial one', function test() {
      return Promise.map(tokenHolder.slice(1), (token) => (
        this.users.dispatch(eraseRoute, { params: { username, token: token.split('.')[1] } })
      ));
    });

    it('returns first page, one token', function test() {
      return this.users.dispatch(listRoute, { params: { username } })
        .then((tokens) => {
          // default page size
          assert.equal(tokens.length, 1);
          const [token] = tokens;

          // check it's first token
          assert.equal(token.name, 'initial token');
          assert(token.userId);
          assert.equal(token.userId, this.userId);
          assert.ok(token.added);
          assert.ok(token.uuid);
          assert.equal(Object.keys(token).length, 5);
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

    it('verifies that all other tokens dont work', function test() {
      return Promise.map(tokenHolder.slice(1), (token) => (
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

  after('clean up redis', global.clearRedis);

  before('start service', function startService() {
    return global.startService.call(this, { registrationLimits: { checkMX: false } });
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
