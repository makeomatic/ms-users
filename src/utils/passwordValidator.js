const zxcvbn = require('zxcvbn');
const assert = require('assert');
const { NotFoundError } = require('common-errors');

const regKeyword = 'password';
const { hasOwnProperty } = Object.prototype;
const { isArray } = Array;

/**
 * Generates readable error including some Suggestions and Reasons
 * @param {*} result
 * @param {string} dataPath
 */
function validatorError(result, dataPath) {
  let message = 'failed complexity check';
  const { feedback } = result;

  if (typeof feedback === 'object' && feedback !== null) {
    const { warning, suggestions } = feedback;
    if (warning !== '') {
      message = `${message}. ${warning}`;
    }

    if (isArray(suggestions) && suggestions.length > 0) {
      message = `${message}. ${suggestions.join(' ')}`;
    }
  }

  return { keyword: regKeyword, dataPath, message };
}

/**
 * Returns func for AJV validator keyword
 * @param {validatorConfig} config
 */
function getValidatorFn(config) {
  // service may not have its config changed after start
  const { forceCheckFieldName, inputFieldNames, minStrength, enabled } = config;

  return function validate(schema, data, parentSchema, currentPath, parentObject) {
    let forceValidate;
    if (Array.isArray(forceCheckFieldName) && forceCheckFieldName.length > 0) {
      forceValidate = forceCheckFieldName.reduce((prev, fieldName) => {
        if (prev) return prev;
        if (parentObject[fieldName]) return true;
        return false;
      }, false);
    }

    const validatorEnabled = forceValidate || enabled;
    if (!validatorEnabled) {
      return true;
    }

    const userInput = inputFieldNames.reduce((prev, fieldName) => {
      if (hasOwnProperty.call(parentObject, fieldName)) {
        prev.push(parentObject[fieldName]);
      }

      return prev;
    }, []);

    const result = zxcvbn(data, userInput);
    if (result.score < minStrength) {
      validate.errors = [validatorError(result, currentPath)];
      return false;
    }

    return true;
  };
}

/**
 * Attaches 'password' keyword to global AJV
 * Schema:
 * "password": {
 *    "type": "string",
 *    "password":true
 *  },
 * @param {Mfleet} service
 */
function attachKeyword(service) {
  assert(service.hasPlugin('validator'), new NotFoundError('validator module must be included'));

  const { $ajv } = service.validator;
  const { passwordValidator } = service.config;

  $ajv.addKeyword(regKeyword, {
    validate: getValidatorFn(passwordValidator),
    errors: true,
  });
}

module.exports = attachKeyword;
