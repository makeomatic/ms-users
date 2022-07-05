module.exports.signedRequest = {
  // see https://www.npmjs.com/package/http-signature headers
  headers: ['digest', '(request-target)', '(algorithm)', '(keyid)'],
  clockSkew: 600, // seconds to invalidate request if 'x-date' or 'date' set
};
