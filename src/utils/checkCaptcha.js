const Promise = require('bluebird');
const Errors = require('common-errors');
const request = require('request-promise');
const defaults = require('lodash/defaults');
const pick = require('lodash/pick');
const fmt = require('util').format;
const handlePipeline = require('../utils/pipelineError.js');

/**
 * Performs captcha check, returns thukn
 * @param  {redisCluster} redis
 * @param  {String} username
 * @param  {String} captcha
 * @param  {Object} captchaConfig
 * @return {Function}
 */
module.exports = function makeCaptchaCheck(redis, username, captcha, captchaConfig) {
  const { secret, ttl, uri } = captchaConfig;
  return function checkCaptcha() {
    const captchaCacheKey = captcha.response;
    return redis
      .pipeline()
      .set(captchaCacheKey, username, 'EX', ttl, 'NX')
      .get(captchaCacheKey)
      .exec()
      .then(handlePipeline)
      .spread(function captchaCacheResponse(setResponse, getResponse) {
        if (getResponse !== username) {
          const msg = 'Captcha challenge you\'ve solved can not be used, please complete it again';
          throw new Errors.HttpStatusError(412, msg);
        }
      })
      .then(function verifyGoogleCaptcha() {
        return request
          .post({ uri, qs: defaults(captcha, { secret }), json: true })
          .then(function captchaSuccess(body) {
            if (!body.success) {
              return Promise.reject(new Errors.HttpStatusError(200, body));
            }

            return true;
          })
          .catch(function captchaError(err) {
            const errData = JSON.stringify(pick(err, ['statusCode', 'error']));
            throw new Errors.HttpStatusError(412, fmt('Captcha response: %s', errData));
          });
      });
  };
};
