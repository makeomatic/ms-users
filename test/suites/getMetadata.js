/* global inspectPromise */
const { expect } = require('chai');
const simpleDispatcher = require('./../helpers/simpleDispatcher');

describe('#getMetadata', function getMetadataSuite() {
  beforeEach(global.startService);
  afterEach(global.clearRedis);

  it('must reject to return metadata on a non-existing username', function test() {
    const { defaultAudience: audience } = this.users._config.jwt;

    return simpleDispatcher(this.users.router)('users.getMetadata', { username: 'noob', audience })
      .reflect()
      .then(getMetadata => {
        expect(getMetadata.isRejected()).to.be.eq(true);
        expect(getMetadata.reason().name).to.be.eq('HttpStatusError');
        expect(getMetadata.reason().statusCode).to.be.eq(404);
      });
  });

  describe('existing user', function suite() {
    const username = 'v@makeomatic.ru';
    const audience = '*.localhost';

    beforeEach(function pretest() {
      return simpleDispatcher(this.users.router)('users.register', { username, password: '123', audience, metadata: { name: { q: 'verynicedata' } } });
    });

    beforeEach(function pretest() {
      return simpleDispatcher(this.users.router)('users.updateMetadata', { username, audience: 'matic.ninja', metadata: { $set: { iat: 10 } } });
    });

    it('must return metadata for a default audience', function test() {
      return simpleDispatcher(this.users.router)('users.getMetadata', { username, audience })
        .reflect()
        .then(inspectPromise())
        .then(getMetadata => {
          expect(getMetadata).to.be.deep.eq({
            [audience]: {
              name: {
                q: 'verynicedata',
              },
              username,
            },
          });
        });
    });

    it('must return metadata for default and passed audiences', function test() {
      return simpleDispatcher(this.users.router)('users.getMetadata', { username, audience: [audience, 'matic.ninja'] })
        .reflect()
        .then(inspectPromise())
        .then(getMetadata => {
          expect(getMetadata).to.be.deep.eq({
            [audience]: {
              name: {
                q: 'verynicedata',
              },
              username,
            },
            'matic.ninja': {
              iat: 10,
            },
          });
        });
    });

    it('must return partial response for default and passed audiences', function test() {
      return simpleDispatcher(this.users.router)('users.getMetadata', {
        username,
        audience: [audience, 'matic.ninja'],
        fields: {
          [audience]: ['username'],
          'matic.ninja': ['iat'],
        },
      }).reflect()
        .then(inspectPromise())
        .then(getMetadata => {
          expect(getMetadata).to.be.deep.eq({
            [audience]: {
              username,
            },
            'matic.ninja': {
              iat: 10,
            },
          });
        });
    });
  });
});
