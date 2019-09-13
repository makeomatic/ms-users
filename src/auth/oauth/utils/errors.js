const Errors = require('common-errors');
const Boom = require('@hapi/boom');

exports.Redirect = Errors.helpers.generateClass('Redirect', {
  args: ['redirectUri'],
});

const OAuthError = exports.OAuthError = Errors.helpers.generateClass('OAuthError', {
  args: ['message', 'inner_error'],
});

/**
 * Removes `@hapi/boom` attributes and some unnecessary data if it's isResponseError
 * @param error
 * @returns {*|{stack: *, data: *, name: *, message: *}|{stack: *, data: *, name: *, message: *}}
 */
function stripBoomAttrs(error) {
  const { message, name, stack } = error;
  let data;

  // Remove http.IncomingMessage
  if (error.isResponseError) {
    const { res, ...otherData } = error.data;
    data = otherData;
  } else {
    ({ data } = error);
  }

  // Recursive check
  if (error.data instanceof Boom) {
    data = stripBoomAttrs(error.data);
  }

  return {
    message,
    name,
    stack,
    data,
  };
}

/**
 * Removes unnecessary data from inner errors
 * And returns simplified object
 * @returns {{inner_error: *}}
 */
OAuthError.prototype.toJSON = function toJSON() {
  const { inner_error: innerError, message, name, stack } = this;
  let innerErrorObj;

  if (innerError instanceof Boom) {
    innerErrorObj = stripBoomAttrs(innerError);
  } else {
    innerErrorObj = innerError;
  }

  const errObject = {
    message,
    name,
    stack,
    inner_error: innerErrorObj,
  };

  return errObject;
};
