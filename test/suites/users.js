const Errors = require('common-errors');
const chai = require('chai');

const { expect } = chai;

describe('configuration suite', function ConfigurationSuite() {
  const Users = require('../../src');

  it('must throw on invalid configuration', function test() {
    expect(function throwOnInvalidConfiguration() {
      try {
        return new Users();
      } catch (e) {
        // assert.ifError now wraps the original error into an AttributeError
        throw e.actual;
      }
    }).to.throw(Errors.ValidationError);
  });
});
