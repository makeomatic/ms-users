/* global inspectPromise */
const { expect } = require('chai');

describe('#updateMetadata', function getMetadataSuite() {
  const headers = { routingKey: 'users.updateMetadata' };
  const username = 'v@makeomatic.ru';
  const audience = '*.localhost';

  beforeEach(global.startService);
  afterEach(global.clearRedis);

  beforeEach(function pretest() {
    return this.users.router({ username, password: '123', audience }, { routingKey: 'users.register' });
  });

  it('must reject updating metadata on a non-existing user', function test() {
    return this.users.router({ username: 'ok google', audience, metadata: { $remove: ['test'] } }, headers)
      .reflect()
      .then(inspectPromise(false))
      .then(getMetadata => {
        expect(getMetadata.name).to.be.eq('HttpStatusError');
        expect(getMetadata.statusCode).to.be.eq(404);
      });
  });

  it('must be able to add metadata for a single audience of an existing user', function test() {
    return this.users.router({ username, audience, metadata: { $set: { x: 10 } } }, headers)
      .reflect()
      .then(inspectPromise());
  });

  it('must be able to remove metadata for a single audience of an existing user', function test() {
    return this.users.router({ username, audience, metadata: { $remove: ['x'] } }, headers)
      .reflect()
      .then(inspectPromise());
  });

  it('must be able to perform batch add/remove operations for a single audience of an existing user');
});
