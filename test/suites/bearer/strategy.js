const { inspectPromise } = require('@makeomatic/deploy');
const assert = require('assert');
const request = require('request-promise').defaults({
  uri: 'http://localhost:3000/users/_/me',
  json: true,
  gzip: true,
  simple: true,
});

describe('/_/me', function verifySuite() {
  beforeEach(global.startService);
  afterEach(global.clearRedis);

  it('must reject on missing JWT token', function test() {
    return request.get()
      .promise()
      .reflect()
      .then(inspectPromise(false))
      .then(({ error, statusCode }) => {
        assert.equal(statusCode, 401);
        assert.equal(error.name, 'HttpStatusError');
        assert.equal(error.message, 'Credentials Required');
        assert.equal(error.error, 'Unauthorized');
        assert.equal(error.statusCode, 401);
      });
  });

  it('must reject on an invalid JWT token', function test() {
    return request
      .get({
        headers: {
          authorization: 'JWT stop.not.working',
        },
      })
      .promise()
      .reflect()
      .then(inspectPromise(false))
      .then(({ error, statusCode }) => {
        assert.equal(statusCode, 403);
        assert.equal(error.name, 'HttpStatusError');
        assert.equal(error.message, 'invalid token');
        assert.equal(error.error, 'Forbidden');
        assert.equal(error.statusCode, 403);
      });
  });

  it('must reject on an expired JWT token', function test() {
    const jwt = require('jsonwebtoken');

    const {
      hashingFunction: algorithm, secret, issuer, defaultAudience,
    } = this.users._config.jwt;

    const token = jwt.sign({ username: 'vitaly' }, secret, { algorithm, audience: defaultAudience, issuer });

    return request
      .get({ headers: { authorization: `JWT ${token}` } })
      .promise()
      .reflect()
      .then(inspectPromise(false))
      .then(({ error, statusCode }) => {
        assert.equal(statusCode, 403);
        assert.equal(error.name, 'HttpStatusError');
        assert.equal(error.message, 'token has expired or was forged');
        assert.equal(error.error, 'Forbidden');
        assert.equal(error.statusCode, 403);
      });
  });

  describe('valid token', function suite() {
    const jwt = require('../../../src/utils/jwt');

    beforeEach(function pretest() {
      return this.dispatch('users.register', {
        username: 'v@makeomatic.ru',
        password: '123',
        audience: 'test',
        metadata: {
          fine: true,
        },
      });
    });

    beforeEach(async function pretest() {
      const data = await jwt.login.call(this.users, 'v@makeomatic.ru', 'test');
      this.token = data.jwt;
    });

    it('must return user object and required audiences information on a valid JWT token', function test() {
      return request
        .get({ headers: { authorization: `JWT ${this.token}` }, qs: { audience: 'test' } })
        .then((body) => {
          assert.equal(body.username, 'v@makeomatic.ru');
          assert.equal(body.metadata['*.localhost'].username, 'v@makeomatic.ru');
          assert.deepEqual(body.metadata.test, { fine: true });
        });
    });

    it('must return user object and required audiences information on a valid JWT token', function test() {
      return this.users.amqp
        .publishAndWait('users._.me', { audience: 'test' }, {
          headers: { authorization: `JWT ${this.token}` },
        })
        .then((body) => {
          assert.equal(body.username, 'v@makeomatic.ru');
          assert.equal(body.metadata['*.localhost'].username, 'v@makeomatic.ru');
          assert.deepEqual(body.metadata.test, { fine: true });
        });
    });
  });
});
