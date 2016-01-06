const Errors = require('common-errors');
const chai = require('chai');
const { expect } = chai;

describe('configuration suite', function ConfigurationSuite() {
  const Users = require('../../lib');

  it('must throw on invalid configuration', function test() {
    expect(function throwOnInvalidConfiguration() {
      return new Users();
    }).to.throw(Errors.ValidationError);
  });
});
