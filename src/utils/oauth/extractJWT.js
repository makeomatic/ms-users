const { parse } = require('tough-cookie');

const hasOwnProperty = Object.prototype.hasOwnProperty;

/**
* Extract the JWT from URL, Auth Header or Cookie
* @param {Object} request - standard hapi request object inclduing headers
* @param {Object} options - the configuration options defined by the person
* using the plugin. this includes relevant keys. (see docs in Readme)
* @returns {String} token - the raw JSON Webtoken or `null` if invalid
*/
module.exports = function extract(request, options = {}) {
// The key holding token value in url or cookie defaults to token
  const pattern = /jwt\s+([^$]+)/i;
  const urlKey = options.urlKey || 'token';
  const cookieKey = options.cookieKey || 'token';
  const headerKey = options.headerKey || 'authorization';

  const hasQueryKey = hasOwnProperty(request.query, urlKey);
  if (hasQueryKey) {
    return request.query[urlKey];
  }

  const hasHeaderKey = hasOwnProperty(request.headers, headerKey);
  if (hasHeaderKey) {
    const token = request.headers[headerKey].match(pattern);
    return token && token[1];
  }

  const { cookie } = request.headers;
  const cookies = cookie && parse(cookie);
  const hasCookieKey = cookies && hasOwnProperty(cookies, cookieKey);
  if (hasCookieKey) {
    return cookies[cookieKey];
  }

  return null;
};
