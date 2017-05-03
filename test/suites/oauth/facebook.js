/* global inspectPromise, globalRegisterUser */

const Promise = require('bluebird');
const assert = require('assert');
const partial = require('lodash/partial');

const oauth = {
  providers: {
    facebook: {
      clientId: '168699090307586',
      clientSecret: '24ede93ba9ae5474e7f49e0c66f4e802',
      location: 'http://localhost:3000/users/oauth/facebook',
    },
  },
};

describe('#facebook', function oauthFacebookSuite() {
  beforeEach(partial(global.startService, { oauth }));
  afterEach(global.clearRedis);

  it('should have all dependencies', function test() {
    assert(global.service);
    assert(global.service.http);
    return null;
  });

  it('should able to initiate authentification', function test() {
    return this.dispatch('/users/oauth/facebook')
      .reflect()
      .then(inspectPromise())
      .then((result) => {
        console.log(result);
      });
  });
});
