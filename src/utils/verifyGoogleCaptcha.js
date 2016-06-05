/**
 * Created by Stainwoortsel on 05.06.2016.
 */
const defaults = require('lodash/defaults');
const Errors = require('common-errors');

const { captcha: captchaConfig } = this; //????? is THIS available here?

module.exports = function verifyGoogleCaptcha(captcha) { //captchaConfig
  const {secret, uri} = captchaConfig;
  return request
    .post({uri, qs: defaults(captcha, {secret}), json: true})
    .then(function captchaSuccess(body) {
      if (!body.success) {
        return Promise.reject({statusCode: 200, error: body});
      }

      return true;
    })
    .catch(function captchaError(err) {
      const errData = JSON.stringify(pick(err, ['statusCode', 'error']));
      throw new Errors.HttpStatusError(412, fmt('Captcha response: %s', errData));
    });
};
