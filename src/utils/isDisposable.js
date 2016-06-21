const disposableDomains = require('disposable-email-domains');
const { ModelError, ERR_EMAIL_DISPOSABLE } = require('../model/modelError');

// init pointers
const disposablePointers = {};
disposableDomains.reduce((acc, domain) => {
  disposablePointers[domain] = true;
  return acc;
}, disposablePointers);

/**
 * Checks whether an email is disposable or not and returns a promise
 * @param  {String}  email
 * @return {Boolean}
 */
module.exports = function isDisposable(email) {
  const domain = email.split('@')[1];
  return function testDisposable() {
    if (disposablePointers[domain]) {
      throw new ModelError(ERR_EMAIL_DISPOSABLE);
    }

    return email;
  };
};
