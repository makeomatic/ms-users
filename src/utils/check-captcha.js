const Errors = require('common-errors');
const { fetch } = require('undici');
const fmt = require('util').format;
const handlePipeline = require('./pipeline-error');

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

  const [, getResponse] = handlePipeline(
    await redis
      .pipeline()
      .set(captchaCacheKey, username, 'EX', ttl, 'NX')
      .get(captchaCacheKey)
      .exec()
  );

  if (getResponse !== username) {
    const msg = 'Captcha challenge you\'ve solved can not be used, please complete it again';
    throw new Errors.HttpStatusError(412, msg);
  }

  try {
    const url = new URL(uri);
    url.searchParams = new URLSearchParams({
      ...captcha,
      secret,
    });
    const { statusCode, body } = await fetch(url, {
      method: 'POST',
      qs: { ...captcha, secret },
    });

    if (statusCode !== 200) {
      throw new Errors.HttpStatusError(statusCode, await body.text());
    }

    const data = await body.json();
    if (!data.success) {
      throw new Errors.HttpStatusError(200, body);
    }
  } catch (err) {
    const errData = JSON.stringify({ statusCode: err.statusCode, error: err.error });
    throw new Errors.HttpStatusError(412, fmt('Captcha response: %s', errData));
  }

  return true;
};
