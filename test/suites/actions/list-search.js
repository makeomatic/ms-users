const Promise = require('bluebird');
const { strict: assert } = require('assert');
const { expect } = require('chai');
const { faker } = require('@faker-js/faker');
const ld = require('lodash');
const redisKey = require('../../../src/utils/key');
const { redisIndexDefinitions } = require('../../configs/redis-indexes');
const { USERS_INDEX, USERS_METADATA } = require('../../../src/constants');

const TEST_CATEGORY = 'test';
const TEST_AUDIENCE = 'api';
const TEST_AUDIENCE_HTTP = 'http';

const getUserName = (audience) => (data) => data.metadata[audience].username;

const sortByCaseInsensitive = (getMember) => (list) => list
  .sort((a, b) => getMember(a).toLowerCase() < getMember(b).toLowerCase());

const createUser = (id, { username, firstName, lastName } = {}) => ({
  id,
  metadata: {
    username: username || faker.internet.email(),
    firstName: firstName || faker.name.firstName(),
    lastName: lastName === undefined ? faker.name.lastName() : lastName,
  },
});

const createUserApi = (id, { email, level } = {}) => ({
  id,
  test: {
    id,
    email: email || faker.internet.email(),
    level: level || 1,
  },
});

const saveUser = (redis, category, audience, user) => redis
  .pipeline()
  .sadd(USERS_INDEX, user.id)
  .hmset(
    redisKey(user.id, category, audience),
    ld.mapValues(user[category], JSON.stringify.bind(JSON))
  )
  .exec();

function listRequest(filter, criteria = 'username', order = 'ASC') {
  return this.users
    .dispatch('list', {
      params: {
        criteria,
        order,
        audience: this.audience,
        filter,
      },
    });
}

describe('Redis Search: list', function listSuite() {
  this.timeout(50000);

  const ctx = {
    redisSearch: {
      enabled: true,
    },
    redisIndexDefinitions,
  };

  const totalUsers = 10;

  beforeEach(async function startService() {
    await global.startService.call(this, ctx);
  });
  afterEach('reset redis', global.clearRedis);

  beforeEach('populate redis', function populateRedis() {
    const audience = this.users.config.jwt.defaultAudience;
    const promises = [];

    ld.times(totalUsers, () => {
      const user = createUser(this.users.flake.next());
      const item = saveUser(this.users.redis, USERS_METADATA, audience, user);
      promises.push(item);
    });

    const people = [
      { username: 'ann@gmail.org', firstName: 'Ann', lastName: faker.lastName },
      { username: 'johnny@gmail.org', firstName: 'Johhny', lastName: faker.lastName },
      { username: 'joe@yahoo.org', firstName: 'Joe', lastName: null },
      { username: 'ann@yahoo.org', firstName: 'Anna', lastName: faker.lastName },
      { username: 'kim@yahoo.org', firstName: 'Kim', lastName: 'Johhny' },
    ];

    for (let i = 0; i < people.length; i += 1) {
      const item = people[i];
      const userId = this.users.flake.next();
      const user = createUser(userId, { ...item });

      const inserted = saveUser(this.users.redis, USERS_METADATA, audience, user);
      promises.push(inserted);

      const { username } = item;

      const api = createUserApi(userId, { email: username, level: (i + 1) * 10 });
      const data = saveUser(this.users.redis, TEST_CATEGORY, TEST_AUDIENCE, api);
      promises.push(data);
      promises.push(
        saveUser(this.users.redis, TEST_CATEGORY, TEST_AUDIENCE_HTTP, api)
      );
    }

    this.audience = audience;
    this.extractUserName = getUserName(this.audience);

    this.filteredListRequest = listRequest.bind(this);

    this.userStubs = Promise.all(promises);
    return this.userStubs;
  });

  it('responds with error when index not created', async function test() {
    const query = {
      params: {
        audience: 'not-existing-audience',
      },
    };

    await assert.rejects(
      this.users.dispatch('list', query),
      /Search index does not registered for/
    );
  });

  it('adds only specific users to index', function test() {
    return this.users
      .dispatch('list', {
        params: {
          offset: 0,
          limit: 100,
          audience: TEST_AUDIENCE_HTTP,
          filter: {},
        },
      })
      .then((result) => {
        expect(result.users.length).to.be.greaterThan(0);

        result.users.forEach((user) => {
          console.debug(user.metadata);
          expect(user).to.have.ownProperty('id');
          expect(user.metadata[TEST_AUDIENCE_HTTP].level).to.be.greaterThanOrEqual(30);
        });
      });
  });

  it('list by username', function test() {
    return this
      .users
      .dispatch('list', {
        params: {
          offset: 0,
          limit: 10,
          criteria: 'username', // sort by
          audience: this.audience,
          filter: {
            username: 'yahoo',
          },
        },
      })
      .then((result) => {
        expect(result.users).to.have.length.lte(10);
        expect(result.users.length);

        result.users.forEach((user) => {
          expect(user).to.have.ownProperty('id');
          expect(user).to.have.ownProperty('metadata');
          expect(user.metadata[this.audience]).to.have.ownProperty('firstName');
          expect(user.metadata[this.audience]).to.have.ownProperty('lastName');
        });

        const copy = [].concat(result.users);
        sortByCaseInsensitive(this.extractUserName)(copy);

        copy.forEach((data) => {
          expect(data.metadata[this.audience].username).to.match(/yahoo/i);
        });

        expect(copy).to.be.deep.eq(result.users);
      });
  });

  it('list by first name', function test() {
    return this
      .filteredListRequest({ firstName: 'Johhny' }, 'firstName')
      .then((result) => {
        assert(result);
        expect(result.users).to.have.length(1);
        const [u1] = result.users;

        assert(u1);
        const uname = this.extractUserName(u1);
        expect(uname).to.be.equal('johnny@gmail.org');
      });
  });

  it('list by multi-word email', function test() {
    return this
      .filteredListRequest({ username: 'ann@gmail.org' })
      .then((result) => {
        assert(result);
        assert(result.users.length);
        expect(result.users).to.have.length(1);

        expect(this.extractUserName(result.users[0])).to.be.equal('ann@gmail.org');
      });
    // @username:($f_username_1 $f_username_2 $f_username_3)
    // PARAMS 6 f_username_1 ann f_username_2 gmail f_username_3
  });

  it('list using partial username', function test() {
    return this
      .filteredListRequest({ username: 'yahoo.org' })
      .then((result) => {
        assert(result);
        assert(result.users.length);
      });
  });

  it('user list if username has only 1 token', function test() {
    return this
      .filteredListRequest({ username: 'org' })
      .then((result) => {
        assert(result);
        expect(result.users).to.have.length.gte(4);
      });
  });

  it('list with #multi fields', function test() {
    return this
      .filteredListRequest({
        '#multi': {
          fields: [
            'firstName',
            'lastName',
          ],
          match: 'Johhny',
        },
      })
      .then((result) => {
        assert(result);
        expect(result.users).to.have.length.gte(2);

        const copy = [].concat(result.users);
        sortByCaseInsensitive(this.extractUserName)(copy);

        const [u1, u2] = copy;
        expect(this.extractUserName(u1)).to.be.equal('johnny@gmail.org');
        expect(this.extractUserName(u2)).to.be.equal('kim@yahoo.org');
      });
  });

  it('list with #multi fields, tokens, partial search, DESC order', function test() {
    // @firstName|lastName:($f_firstName_lastName_m_1*) PARAMS 2 f_firstName_lastName_m_1 Joh
    // DIALECT 2 SORTBY username DESC LIMIT 0 10 NOCONTENT
    return this
      .filteredListRequest({
        '#multi': {
          fields: [
            'firstName',
            'lastName',
          ],
          match: 'Joh', // hny
        },
      }, 'username', 'DESC')
      .then((result) => {
        assert(result);
        expect(result.users).to.have.length.gte(2);

        const copy = [].concat(result.users);
        sortByCaseInsensitive(this.extractUserName)(copy);

        const [u1, u2] = copy;
        expect(this.extractUserName(u1)).to.be.equal('kim@yahoo.org');
        expect(this.extractUserName(u2)).to.be.equal('johnny@gmail.org');
      });
  });

  it('list: EQ action', function test() {
    return this
      .filteredListRequest({ username: { eq: 'kim@yahoo.org' } })
      .then((result) => {
        assert(result);
        expect(result.users).to.have.length(0);
      });
  });

  it('list: MATCH action with one token', function test() {
    // @firstName:($f_firstName_m*) PARAMS 2 f_firstName_m Johhny
    return this
      .filteredListRequest({ firstName: { match: 'Johhny' } })
      .then((result) => {
        assert(result);
        expect(result.users).to.have.length.gte(1);
      });
  });

  it('list: MATCH action with multiWords', function test() {
    //  @username:($f_username_m_1 $f_username_m_2 $f_username_m_3*) PARAMS 6 f_username_m_1 johnny f_username_m_2 gmail f_username_m_3 org
    return this
      .filteredListRequest({ username: { match: 'johnny@gmail.org' } })
      .then((result) => {
        assert(result);
        expect(result.users).to.have.length(1);
      });
  });

  it('list: MATCH action with multiWords and partial search', function test() {
    //  @username:($f_username_m_1 $f_username_m_2*) PARAMS 4 f_username_m_1 johnny f_username_m_2 gma
    return this
      .filteredListRequest({ username: { match: 'johnny@gma' } })
      .then((result) => {
        assert(result);
        expect(result.users).to.have.length(1);
      });
  });
  it('list: NE action', function test() {
    return this
      .filteredListRequest({ username: { ne: 'gmail' } })
      .then((result) => {
        assert(result);
        expect(result.users).to.have.length.gte(2);

        result.users.forEach((user) => {
          const username = this.extractUserName(user);
          const domain = username.split('@')[1];
          expect(domain).to.have.length.gte(1);
          // TODO expect(domain.includes('gmail')).to.equal(false)
        });
      });
  });

  it('list: IS_EMPTY action', function test() {
    return this
      .filteredListRequest({ lastName: { isempty: true } })
      .then((result) => {
        assert(result);
        expect(result.users).to.have.length(0);
      });
  });

  it('list: EXISTS action', function test() {
    return this
      .filteredListRequest({ lastName: { exists: true } })
      .then((result) => {
        assert(result);
        expect(result.users).to.have.length.gte(1);
      });
  });

  it('list by id', function test() {
    // -@id:{$f_id_ne} PARAMS 2 f_id_ne unknown
    return this
      .users
      .dispatch('list', {
        params: {
          offset: 0,
          limit: 3,
          criteria: 'id', // sort by
          audience: this.audience,
          filter: {
            '#': { ne: 'unknown' },
          },
        },
      })
      .then((result) => {
        assert(result);
        expect(result.users).to.have.length(3);

        result.users.forEach((user) => {
          expect(user).to.have.ownProperty('id');
        });
      });
  });

  it('list: TAG ANY action', function test() {
    // More readable query is:
    //   @email_tag: {$f_any_0_email_tag, $f_any_1_email_tag }
    // This one in a bit more complex:
    //   ( (@email_tag:{$f_any_0_email_tag}) | (@email_tag:{$f_any_1_email_tag}) )
    //   PARAMS 4 f_any_0_email_tag \\\"joe@yahoo.org\\\" f_any_1_email_tag \\\"ann@yahoo.org\\\"
    return this
      .users
      .dispatch('list', {
        params: {
          audience: TEST_AUDIENCE,
          filter: {
            email_tag: {
              any: [
                'joe@yahoo.org',
                'ann@yahoo.org',
              ],
            },
          },
        },
      })
      .then((result) => {
        assert(result);
        expect(result.users).to.have.length(2);

        result.users.forEach((user) => {
          expect(user).to.have.ownProperty('id');
        });
      });
  });

  it('list: ANY action', function test() {
    // (
    //  (@email:($f_email_any_0_1 $f_email_any_0_2 $f_email_any_0_3))
    //  |
    //  (@email:($f_email_any_1_1 $f_email_any_1_2 $f_email_any_1_3))
    // ) PARAMS 12
    //     f_email_any_0_1 joe f_email_any_0_2 yahoo f_email_any_0_3 org f_email_any_1_1 ann f_email_any_1_2 yahoo f_email_any_1_3 org
    const emails = [
      'joe@yahoo.org',
      'ann@yahoo.org',
    ];

    return this
      .users
      .dispatch('list', {
        params: {
          audience: TEST_AUDIENCE,
          filter: {
            email: {
              any: emails,
            },
          },
        },
      })
      .then((result) => {
        assert(result);
        expect(result.users).to.have.length(2);

        result.users.forEach((user) => {
          expect(user).to.have.ownProperty('id');
          // one of the emails
          expect(emails).to.contain(user.metadata.api.email);
        });
      });
  });

  it('list: ANY action gte/lte fn', function test() {
    // ( (@level:[10 20]) | (@level:[35 +inf]) )
    const levels = [
      {
        gte: 10, lte: 20,
      },
      { gte: 35 },
    ];

    return this
      .users
      .dispatch('list', {
        params: {
          audience: TEST_AUDIENCE,
          filter: {
            level: {
              any: levels,
            },
          },
        },
      })
      .then((result) => {
        assert(result);
        expect(result.users).to.have.length(4);

        result.users.forEach((user) => {
          expect(user).to.have.ownProperty('id');
          expect(user.metadata[TEST_AUDIENCE].level)
            .to.satisfy((value) => (value >= 10 && value <= 20) || value >= 35);
        });
      });
  });

  it('use custom audience', function test() {
    // FT.SEARCH {ms-users}-test-api-idx @level:[-inf 40]
    return this
      .users
      .dispatch('list', {
        params: {
          criteria: 'level',
          audience: TEST_AUDIENCE,
          filter: {
            level: { lte: 30 },
          },
        },
      })
      .then((result) => {
        expect(result.users).to.have.length(3);
        expect(result.users.length);

        result.users.forEach((user) => {
          expect(user).to.have.ownProperty('id');
          expect(user).to.have.ownProperty('metadata');

          const data = user.metadata[TEST_AUDIENCE];
          expect(data).to.have.ownProperty('email');
          expect(data.email.endsWith('.org'));

          expect(data).to.have.ownProperty('level');
          expect(data.level).to.be.lte(30); // 10 20 30
        });
      });
  });
});
