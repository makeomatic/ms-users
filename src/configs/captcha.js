/**
 * Provides configuration for google recaptcha
 * NOTE: this is not heavily tested, use with care
 * @type {Object}
 */
exports.captcha = {
  secret: 'put-your-real-gcaptcha-secret-here',
  ttl: 3600, // 1 hour - 3600 seconds
  uri: 'https://www.google.com/recaptcha/api/siteverify',
};
