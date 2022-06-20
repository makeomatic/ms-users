const { createHmac } = require('crypto');
const { sign } = require('http-signature');
const Url = require('url');

function RequestLike(opts) {
  const url = typeof opts.url === 'string' ? Url.parse(opts.url) : opts.url;
  if (!opts.headers) opts.headers = {};

  return {
    ...opts,
    url,
    getHeader(name) {
      return opts.headers[name];
    },
    setHeader(name, value) {
      opts.headers[name.toLowerCase()] = value;
    },
    path: `${url.pathname}${url.search || ''}`,
  };
}

/**
 * @param {HttpRequestLike} wrapped
 * @param {Object} signature
 */
const signRequest = (wrapped, signature) => {
  let toSign = '';
  if (wrapped.json) {
    toSign = JSON.stringify(wrapped.json);
  }

  if (wrapped.body) {
    toSign = wrapped.body;
  }

  const digestSignature = createHmac('sha512', signature.key)
    .update(toSign)
    .digest('base64');

  wrapped.setHeader('digest', digestSignature);
  console.debug({ signature });

  sign(wrapped, {
    ...signature,
    strict: true,
    headers: ['digest', '(request-target)', '(algorithm)', '(keyid)'],
  });
};

const preRequest = (options) => {
  const { signature } = options;

  if (!signature) {
    return;
  }

  const wrapped = new RequestLike(options);
  signRequest(wrapped, signature);
};

module.exports = {
  preRequest, signRequest, RequestLike,
};
