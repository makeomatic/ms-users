const { HttpStatusError } = require('common-errors');

const getMetadata = require('./get-metadata');
const { getInternalData } = require('./userData');
const { USERS_MFA_FLAG } = require('../constants');

/**
 * Verifies decoded token
 * @returns {Promise<{
 *  id: String,
 *  metadata: {},
 *  mfa: boolean,
 * }>}
 */
async function fromTokenData(service, { username, userId, scopes }, params) {
  if (!userId && !username) {
    throw new HttpStatusError(403, 'forged or expired token');
  }

  const { audience, defaultAudience } = params;

  // push extra audiences
  if (audience.indexOf(defaultAudience) === -1) {
    audience.push(defaultAudience);
  }

  let resolveduserId = userId;
  let hasMFA;
  if (resolveduserId == null) {
    const internalData = await getInternalData.call(service, username);
    resolveduserId = internalData.id;
    hasMFA = !!internalData[USERS_MFA_FLAG];
  }

  const metadata = await getMetadata(service, resolveduserId, audience);
  const result = {
    id: resolveduserId,
    metadata,
    scopes,
  };

  if (hasMFA !== undefined) {
    result.mfa = hasMFA;
  }

  return result;
}

module.exports = {
  fromTokenData,
};
