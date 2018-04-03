const Errors = require('common-errors');
const Promise = require('bluebird');
const dns = Promise.promisifyAll(require('dns'));

/**
 * Checks whether MX record exists or not
 * @param  {String} email
 * @return {Promise}
 */
module.exports = async function mxExists(email) {
  const hostname = email
    .split('@')
    .pop();

  const tld = hostname
    .split('.')
    .slice(-2)
    .join('.');

  const addresses = await dns
    .resolveMxAsync(tld)
    .catchReturn({ code: 'ENOTFOUND' }, [])
    .catchReturn({ code: 'ENODATA' }, []);

  if (addresses && addresses.length > 0) {
    return null;
  }

  throw new Errors.HttpStatusError(400, `no MX record was found for hostname ${hostname}`);
};
