const { NotFoundError } = require('common-errors');

const { USERS_API_TOKENS } = require('../constants');
const redisKey = require('./key');

// display raw token data only when requested
function deserializeTokenData(raw, showSensitive = false) {
  const { scopes, raw: rawToken, ...restData } = raw;
  if (scopes) {
    restData.scopes = JSON.parse(raw.scopes);
  }

  if (restData.type === 'sign' && showSensitive) {
    restData.raw = rawToken;
  }

  return restData;
}

function serializeTokenData(raw) {
  const { scopes, ...restData } = raw;

  if (Array.isArray(scopes)) {
    restData.scopes = JSON.stringify(raw.scopes);
  }

  return restData;
}

function checkTokenData(raw) {
  if (Object.keys(raw).length < 1) {
    throw new NotFoundError('token not found');
  }

  return raw;
}

async function getToken(service, tokenBody, sensitive = false) {
  const key = redisKey(USERS_API_TOKENS, tokenBody);
  const tokenData = await service.redis.hgetall(key);
  checkTokenData(tokenData);

  return deserializeTokenData(tokenData, sensitive);
}

module.exports = {
  deserializeTokenData,
  serializeTokenData,
  checkTokenData,
  getToken,
};
