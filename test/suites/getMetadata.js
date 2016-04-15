/* global inspectPromise */
const { expect } = require('chai');

describe('#getMetadata', function getMetadataSuite() {
  const headers = { routingKey: 'users.getMetadata' };

  beforeEach(global.startService);
  afterEach(global.clearRedis);

  it('must reject to return metadata on a non-existing username', function test() {
    const { defaultAudience: audience } = this.users._config.jwt;

    return this.users.router({ username: 'noob', audience }, headers)
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
      return this.users.router({ username, password: '123', audience, metadata: { name: { q: 'verynicedata' } } }, { routingKey: 'users.register' });
    });

    beforeEach(function pretest() {
      return this.users.router({ username, audience: 'matic.ninja', metadata: { $set: { iat: 10 } } }, { routingKey: 'users.updateMetadata' });
    });

    it('must return metadata for a default audience', function test() {
      return this.users.router({ username, audience }, headers)
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
      return this.users
        .router({ username, audience: [audience, 'matic.ninja'] }, headers)
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
      return this.users
        .router({
          username,
          audience: [audience, 'matic.ninja'],
          fields: {
            [audience]: ['username'],
            'matic.ninja': ['iat'],
          },
        }, headers)
        .reflect()
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
