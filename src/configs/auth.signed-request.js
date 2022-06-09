module.exports.auth = {};

module.exports.auth.signedRequest = {
  // see https://www.npmjs.com/package/http-signature headers
  headers: ['digest', '(request-target)', '(algorithm)', '(keyid)'],
  payloadDigest: 'base64',
  clockSkew: 600, // seconds to invalidate request if 'x-date' or 'date' set
};
