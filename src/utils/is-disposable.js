const Errors = require('common-errors');
const disposableDomains = require('disposable-email-domains');

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
  if (disposablePointers[domain]) {
    throw new Errors.HttpStatusError(400, 'you must use non-disposable email to register');
  }

  return email;
};
