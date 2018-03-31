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
module.exports = async function checkCaptcha(redis, username, captcha, captchaConfig) {
  const { secret, ttl, uri } = captchaConfig;
  const { response: captchaCacheKey } = captcha;

  await redis
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
    });

  try {
    const body = await request.post({ uri, qs: defaults(captcha, { secret }), json: true });

    if (!body.success) {
      throw new Errors.HttpStatusError(200, body);
    }
  } catch (err) {
    const errData = JSON.stringify(pick(err, ['statusCode', 'error']));
    throw new Errors.HttpStatusError(412, fmt('Captcha response: %s', errData));
  }

  return true;
};
