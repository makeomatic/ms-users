const { HttpStatusCode } = require('common-errors');
const { parse } = require('tough-cookie');

const hasOwnProperty = Object.prototype.hasOwnProperty;

/**
* Extract the JWT from URL, Auth Header or Cookie
* @param {Object} request - standard hapi request object inclduing headers
* @param {Object} options - the configuration options defined by the person
* using the plugin. this includes relevant keys. (see docs in Readme)
* @returns {String} token - the raw JSON Webtoken or `null` if not found
*/
module.exports = function extract(request, options = {}) {
  // The key holding token value in url or cookie defaults to token
  const urlKey = options.urlKey || 'token';
  const cookieKey = options.cookieKey || 'token';
  const headerKey = options.headerKey || 'authorization';
  const { headers, query } = request;

  const hasHeaderKey = hasOwnProperty.call(headers, headerKey);
  if (hasHeaderKey) {
    const header = headers[headerKey];
    if (Array.isArray(header)) {
      throw new HttpStatusCode(400, `must only containe one "${headerKey}"`);
    }

    const parts = header.trim().split(' ');
    if (parts.length !== 2) {
      throw new HttpStatusCode(400, `malformed "${headerKey}" header`);
    }

    // if we have schema, which equals to JWT -> pass it on
    const [schema, token] = parts;
    if (schema === 'JWT') return token;
  }

  const hasQueryKey = hasOwnProperty.call(query, urlKey);
  if (hasQueryKey) {
    return request.query[urlKey];
  }

  const cookieHeader = headers.cookie;
  const cookies = cookieHeader && parse(cookieHeader);
  const hasCookieKey = cookies && hasOwnProperty.call(cookies, cookieKey);
  if (hasCookieKey) {
    return cookies[cookieKey];
  }

  return null;
};
