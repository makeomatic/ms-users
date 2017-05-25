const Errors = require('common-errors');

module.exports.Redirect = Errors.helpers.generateClass('Redirect', {
  args: ['redirectUri'],
});
