const Errors = require('common-errors');
const Boom = require('@hapi/boom');

exports.Redirect = Errors.helpers.generateClass('Redirect', {
  args: ['redirectUri'],
});

const OAuthError = exports.OAuthError = Errors.helpers.generateClass('OAuthError', {
  args: ['message', 'inner_error'],
});

/**
 * Removes `@hapi/boom` attributes
 * @param error
 * @returns {*|{stack: *, data: *, name: *, message: *}}
 */
function stripBoomAttrs(error) {
  const { message, name, stack } = error;
  let data;

  /* Remove http.IncomingMessage - @hapi/wreck adds it when error is coming from response */
  if (error.isResponseError) {
    const { res, ...otherData } = error.data;
    data = otherData;
  } else {
    ({ data } = error);
  }

  /* Recursive check */
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
 * OAuthError.toJSON custom serialization
 * Returns simplified object
 * @returns {*}
 */
OAuthError.prototype.toJSON = function toJSON() {
  const { inner_error: innerError, message, name, stack } = this;
  let innerErrorJsonObj;

  /* Boom error contains additional data */
  if (innerError instanceof Boom) {
    innerErrorJsonObj = stripBoomAttrs(innerError);
  } else {
    innerErrorJsonObj = innerError;
  }

  return {
    message,
    name,
    stack,
    inner_error: innerErrorJsonObj,
  };
};
