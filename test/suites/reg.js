/* global inspectPromise */
const { expect } = require('chai');
const times = require('lodash/times');

describe('#reg', function registerSuite() {
  const headers = { routingKey: 'users.register' };

  beforeEach(global.startService);
  afterEach(global.clearRedis);

  it('must be able to create user without validations and return user object and jwt token', function test() {
    const opts = {
      username: 'v@makeomatic.ru',
      password: 'mynicepassword',
      audience: 'matic.ninja',
    };

    return this.users
      .router(opts, headers)
      .reflect()
      .then(inspectPromise(true))
      .then(registered => {
console.log(registered);
        expect(registered).to.have.ownProperty('jwt');
        expect(registered).to.have.ownProperty('user');
        expect(registered.user.username).to.be.eq(opts.username);
        expect(registered.user).to.have.ownProperty('metadata');
        expect(registered.user.metadata).to.have.ownProperty('matic.ninja');
        expect(registered.user.metadata).to.have.ownProperty('*.localhost');
        expect(registered.user).to.not.have.ownProperty('password');
        expect(registered.user).to.not.have.ownProperty('audience');
      });
  });

});
