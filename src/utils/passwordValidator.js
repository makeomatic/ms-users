const zxcvbn = require('zxcvbn');
const assert = require('assert');
const {
  NotFoundError,
} = require('common-errors');

const regKeyword = 'password';

const has = Object.prototype.hasOwnProperty;

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
    if (suggestions instanceof Array && suggestions.length > 0) {
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
  const { forceCheckFieldName, inputFieldNames } = config;

  return function validate(schema, data, parentSchema, currentPath, parentObject) {
    const { minStrength, enabled } = config;
    const forceValidate = has.call(parentObject, forceCheckFieldName);
    const validatorEnabled = forceValidate || enabled;

    if (!validatorEnabled) {
      return true;
    }

    const userInput = inputFieldNames.reduce((prev, fieldName) => {
      if (has.call(parentObject, fieldName)) {
        return [...prev, parentObject[fieldName]];
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
