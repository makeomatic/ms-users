/**
 * Created by Stainwoortsel on 05.06.2016.
 */
const defaults = require('lodash/defaults');
const request = require('request-promise');
const pick = require('lodash/pick');
const { ModelError, ERR_CAPTCHA_ERROR_RESPONSE } = require('../model/modelError');

module.exports = function verifyGoogleCaptcha(captcha) {
  const { config: { captcha: { captchaConfig: { secret, uri } } } } = this;
  return request
    .post({ uri, qs: defaults(captcha, { secret }), json: true })
    .then(function captchaSuccess(body) {
      if (!body.success) {
        return Promise.reject({ statusCode: 200, error: body });
      }

      return true;
    })
    .catch(function captchaError(err) {
      const errData = JSON.stringify(pick(err, ['statusCode', 'error']));
      throw new ModelError(ERR_CAPTCHA_ERROR_RESPONSE, errData);
    });
};
