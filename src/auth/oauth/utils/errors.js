const Errors = require('common-errors');

exports.Redirect = Errors.helpers.generateClass('Redirect', {
  args: ['redirectUri'],
});
