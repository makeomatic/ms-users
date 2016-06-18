/**
 * Created by Stainwoortsel on 17.06.2016.
 */
const findKey = require('lodash/findKey');
const mapValues = require('lodash/mapValues');
const isFunction = require('lodash/isFunction');
const fmt = require('util').format;
const Errors = require('common-errors');

/**
 * Generate error structure
 * @param code
 * @param http
 * @param msg
 */
const genErr = (code, http, msg) => ({ code, http, msg });

/**
 * Maping error code helper function
 * @param e
 */
const mapErr = (e) => e.code;

/**
 * Error types structure
 * @type {Object}
 */
const ErrorTypes = {
  ERR_ALIAS_ALREADY_ASSIGNED:
    genErr(100, 417, 'alias is already assigned'),
  ERR_ALIAS_ALREADY_TAKEN:
    genErr(101, 409, 'alias was already taken'),
  ERR_ALIAS_ALREADY_EXISTS:
    genErr(102, 409, (alias) => (`"${alias}" already exists`)),
  ERR_USERNAME_ALREADY_ACTIVE:
    genErr(110, 417, (username) => (`${username} is already active`)),
  ERR_USERNAME_ALREADY_EXISTS:
    genErr(111, 409, (username) => (`${username} is already exists`)),
  ERR_USERNAME_NOT_EXISTS:
    genErr(112, 404, (username) => (`${username} does not exists`)),
  ERR_USERNAME_NOT_FOUND:
    genErr(113, 404, 'username was not found'),
  ERR_ACCOUNT_MUST_BE_ACTIVATED:
    genErr(120, 400, 'Account must be activated when setting alias during registration'),
  ERR_ACCOUNT_NOT_ACTIVATED:
    genErr(121, 412, 'Account hasn\'t been activated'),
  ERR_ACCOUNT_ALREADY_ACTIVATED:
    genErr(122, 417, (user) => (`Account ${user} was already activated`)),
  ERR_ACCOUNT_IS_LOCKED:
    genErr(123, 423, 'Account has been locked'),
  ERR_ACCOUNT_IS_ALREADY_EXISTS:
    genErr(124, 412, (username) => (`User "${username}" already exists`)),
  ERR_ADMIN_IS_UNTOUCHABLE:
    genErr(130, 400, 'can\'t remove admin user from the system'),
  ERR_CAPTCHA_WRONG_USERNAME:
    genErr(140, 412, 'Captcha challenge you\'ve solved can not be used, please complete it again'), // eslint-disable-line
  ERR_CAPTCHA_ERROR_RESPONSE:
    genErr(141, 412, (errData) => fmt('Captcha response: %s', errData)),
  ERR_EMAIL_DISPOSABLE:
    genErr(150, 400, 'you must use non-disposable email to register'),
  ERR_EMAIL_NO_MX:
    genErr(151, 400, (hostname) => (`no MX record was found for hostname ${hostname}`)),
  ERR_EMAIL_ALREADY_SENT:
    genErr(152, 429, 'We\'ve already sent you an email, if it doesn\'t come - please try again in a little while or send us an email'), // eslint-disable-line

  ERR_TOKEN_INVALID:
    genErr(160, 403, 'Invalid Token'),
  ERR_TOKEN_AUDIENCE_MISMATCH:
    genErr(161, 403, 'audience mismatch'),
  ERR_TOKEN_MISS_EMAIL:
    genErr(162, 403, 'Decoded token misses references to email and/or secret'),
  ERR_TOKEN_EXPIRED:
    genErr(163, 404, 'token expired or is invalid'),
  ERR_TOKEN_FORGED:
    genErr(164, 403, 'token has expired or was forged'),
  ERR_TOKEN_BAD_EMAIL:
    genErr(165, 412, 'associated email doesn\'t match token'),
  ERR_TOKEN_CANT_DECODE:
    genErr(166, 403, 'could not decode token'),
  ERR_PASSWORD_INVALID:
    genErr(170, 500, 'invalid password passed'),
  ERR_PASSWORD_INVALID_HASH:
    genErr(171, 500, 'invalid password hash retrieved from storage'),
  ERR_PASSWORD_INCORRECT:
    genErr(172, 403, 'incorrect password'),
  ERR_PASSWORD_SCRYPT_ERROR:
    genErr(173, 403, (err) => (err.scrypt_err_message || err.message)),
  ERR_ATTEMPTS_LOCKED:
    genErr(180, 429, (duration) => (`You are locked from making login attempts for the next ${duration}`)),
  ERR_ATTEMPTS_TO_MUCH_REGISTERED:
    genErr(181, 429, 'You can\'t register more users from your ipaddress now'),
};

/**
 * Error codes map
 * @type {Object}
 */
const ErrorCodes = mapValues(ErrorTypes, mapErr);

/**
 * Fabric for error classes with mapToHttp method, to map error into HttpStatusError
 * @param name
 * @param opts
 * @returns {Class} HTTP-mapped error class
 */
const generateHttpMapedClass = function generateHttpMapedClass(name, opts) {
  const Class = Errors.helpers.generateClass(name, opts);

  Class.prototype.mapToHttp = function mapToHttp() {
    const key = findKey(ErrorTypes, { code: this.code });
    const err = ErrorTypes[key];
    return new Errors.HttpStatusError(err.http, this.generateMessage());
  };

  return Class;
};

/**
 * Model error class
 * @type {Class}
 */
const ModelError = generateHttpMapedClass('ModelError', {
  extends: Errors.Error,
  args: ['code', 'data'],
  generateMessage: function generateMessage() {
    const key = findKey(ErrorTypes, { code: this.code });
    const err = ErrorTypes[key];
    return isFunction(err.msg) ? err.msg.call(this, this.data) : err.msg;
  },
});

module.exports = { ...ErrorCodes, ModelError };
