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
  const { message, name, stack, data: errorData } = error;
  let data;

  /* assuming that 'data' not passed or it's not and object when Boom.error created. */
  if (errorData !== null && typeof errorData === 'object') {
    /* Remove http.IncomingMessage - @hapi/wreck adds it when error is coming from response. */
    if (errorData.isResponseError) {
      const { res, ...otherData } = errorData;
      data = otherData;
    } else {
      ({ data } = error);
    }
  } else {
    data = errorData;
  }

  /* Recursive check */
  if (Boom.isBoom(error.data)) {
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
  if (Boom.isBoom(innerError)) {
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
