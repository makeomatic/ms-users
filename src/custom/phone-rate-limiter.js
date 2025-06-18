const { Lifecycle } = require('@microfleet/plugin-router');
const { HttpStatusError } = require('common-errors');
const { RecaptchaEnterpriseServiceClient } = require('@google-cloud/recaptcha-enterprise');

const { KeyIpRateLimiter } = require('../utils/rate-limiters/key-ip-rate-limiter');
const { KeyRateLimiter } = require('../utils/rate-limiters/key-rate-limiter');
const { CHALLENGE_TYPE_PHONE } = require('../constants');

const ErrorCaptchaConfigInvalid = new HttpStatusError(500, 'Invalid reCAPTCHA config');
const ErrorCaptchaInvalid = new HttpStatusError(400, 'Captcha invalid');
const ErrorCaptchaRequired = new HttpStatusError(412, 'Captcha required');
const ErrorIpRequired = new HttpStatusError(400, 'IP address required');

const ErrorLockLimit = (reset) => {
  const error = new HttpStatusError(403, 'Lock limit');

  error.code = 'E_LOCK_LIMIT';
  error.detail = { reset };

  return error;
};
const ErrorTotalLimit = (reset) => {
  const error = new HttpStatusError(403, 'Total limit');

  error.code = 'E_TOTAL_LIMIT';
  error.detail = { reset };

  return error;
};

const ErrorCaptchaError = (error) => new HttpStatusError(500, `Captcha error: ${error.message}`);

ErrorCaptchaInvalid.code = 'E_CAPTCHA_INVALID';
ErrorCaptchaRequired.code = 'E_CAPTCHA_REQUIRED';
ErrorIpRequired.code = 'E_IP_REQUIRED';

const actionUsernameParamNameMap = {
  'disposable-password': ['id', 'challengeType', 'remoteip'],
  'update-username.request': ['value', 'challengeType', 'remoteip'],
  challenge: ['username', 'type', 'remoteip'],
  register: ['username', 'challengeType', 'ipaddress'],
};

const totalRateLimiterKey = 'total';

const getRequestParams = (request) => {
  const { action, params } = request;
  const { actionName } = action;
  const paramsMap = actionUsernameParamNameMap[actionName];

  if (paramsMap === undefined) {
    return null;
  }

  const [usernameParamName, challengeTypeParamName, ipParamName] = paramsMap;
  const {
    [challengeTypeParamName]: challengeType,
    [ipParamName]: remoteIp,
    [usernameParamName]: username,
    captcha,
  } = params;

  if (challengeType !== CHALLENGE_TYPE_PHONE) {
    return null;
  }

  if (!remoteIp) {
    throw ErrorIpRequired;
  }

  return {
    captcha,
    challengeType,
    remoteIp,
    username,
  };
};

const createTotalLimiter = (service) => {
  return new KeyRateLimiter({
    config: service.config.rateLimiters.phoneChallengeTotal,
    name: 'phone-challenge-total',
    redis: service.redis,
  });
};

const createLockLimiter = (service) => {
  return new KeyIpRateLimiter({
    config: service.config.rateLimiters.phoneChallengeLock,
    name: 'phone-challenge-lock',
    redis: service.redis,
  });
};

const createCaptchaLimiter = (service) => {
  return new KeyIpRateLimiter({
    config: service.config.rateLimiters.phoneChallengeCaptcha,
    name: 'phone-challenge-captcha',
    redis: service.redis,
  });
};

const checkTotalLimit = async (service) => {
  try {
    await createTotalLimiter(service).check(totalRateLimiterKey);
  } catch (error) {
    if (error instanceof KeyIpRateLimiter.RateLimitError) {
      throw ErrorTotalLimit(error.reset);
    }

    throw error;
  }
};

const checkLockLimit = async (service, username, remoteIp) => {
  try {
    await createLockLimiter(service).check(username, remoteIp);
  } catch (error) {
    if (error instanceof KeyIpRateLimiter.RateLimitError) {
      throw ErrorLockLimit(error.reset);
    }

    throw error;
  }
};

const checkCaptchaLimit = async (service, username, remoteIp) => {
  try {
    await createCaptchaLimiter(service).check(username, remoteIp);
  } catch (error) {
    if (error instanceof KeyIpRateLimiter.RateLimitError) {
      throw ErrorCaptchaRequired;
    }

    throw error;
  }
};

const validateCaptcha = async ({ config, token }) => {
  if (!config) {
    throw ErrorCaptchaConfigInvalid;
  }

  const { clientEmail, privateKey, projectId, siteKey } = config;

  const client = new RecaptchaEnterpriseServiceClient({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
  });
  const projectPath = client.projectPath(projectId);

  let response;

  try {
    [response] = await client.createAssessment({
      assessment: {
        event: {
          token,
          siteKey,
        },
      },
      parent: projectPath,
    });
  } catch (error) {
    throw ErrorCaptchaError(error);
  }

  if (!response?.tokenProperties?.valid) {
    throw ErrorCaptchaInvalid;
  }
};

async function preHandler(request) {
  const params = getRequestParams(request);

  if (params === null) {
    return;
  }

  await checkTotalLimit(this);

  const { config } = this;
  const { username, remoteIp, captcha } = params;

  await checkLockLimit(this, username, remoteIp);

  if (captcha) {
    await validateCaptcha({ config: config.recaptcha, token: captcha.token });

    return;
  }

  await checkCaptchaLimit(this, username, remoteIp);
}

async function postHandler(request) {
  if (request.error) {
    return;
  }

  const params = getRequestParams(request);

  if (params === null) {
    return;
  }

  const { username, remoteIp } = params;
  const totalRateLimiter = createTotalLimiter(this);
  const lockRateLimiter = createLockLimiter(this);
  const captchaRateLimiter = createCaptchaLimiter(this);

  const results = await Promise.allSettled([
    totalRateLimiter.reserve(totalRateLimiterKey),
    lockRateLimiter.reserve(username, remoteIp),
    captchaRateLimiter.reserve(username, remoteIp),
  ]);

  for (const { reason } of results) {
    if (reason && !(reason instanceof KeyIpRateLimiter.RateLimitError)) {
      throw reason;
    }
  }
}

const phoneChallengeRateLimiter = [
  {
    handler: preHandler,
    point: Lifecycle.hooks.preHandler,
  },
  {
    handler: postHandler,
    point: Lifecycle.hooks.postHandler,
  },
];

module.exports = {
  phoneChallengeRateLimiter,
};
