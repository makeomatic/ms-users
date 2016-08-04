/**
 * Generates complete link
 * @param  {Object} server
 * @param  {String} path
 * @return {String} link
 */
module.exports = function generateLink(server, path) {
  const { proto } = server;
  let { port } = server;

  if ((proto === 'http' && +port === 80) || (proto === 'https' && +port === 443)) {
    port = '';
  } else {
    port = `:${port}`;
  }

  return `${proto}://${server.host + port + path}`;
};
