const zxcvbn = require('zxcvbn');
const { strict: assert } = require('assert');
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
 * Checks whether any of the passed fields exist in the passed object
 * @param object
 * @param fields[string] list of fields
 * @returns {boolean|*}
 */
function anyFieldExists(object, fields) {
  if (Array.isArray(fields) && fields.length > 0) {
    return fields.reduce((prev, fieldName) => {
      if (prev) return prev;
      if (object[fieldName]) return true;
      return false;
    }, false);
  }
  return false;
}

/**
 * Returns func for AJV validator keyword
 * @param {validatorConfig} config
 */
function getValidatorFn(config) {
  const { forceCheckFieldNames, skipCheckFieldNames, inputFieldNames, minStrength, enabled } = config;

  return function validate(schema, data, parentSchema, { parentData: parentObject, instancePath: currentPath }) {
    // Force skip validation check
    const skipValidate = anyFieldExists(parentObject, skipCheckFieldNames);
    if (skipValidate) {
      return true;
    }

    // Force validation check
    const forceValidate = anyFieldExists(parentObject, forceCheckFieldNames);
    if (!enabled && !forceValidate) {
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
 * @param {Microfleet} service
 */
function attachKeyword(service) {
  assert(service.hasPlugin('validator'), new NotFoundError('validator module must be included'));

  const { $ajv } = service.validator;
  const { passwordValidator } = service.config;

  $ajv.addKeyword({
    keyword: regKeyword,
    validate: getValidatorFn(passwordValidator),
    errors: true,
  });
}

module.exports = attachKeyword;
