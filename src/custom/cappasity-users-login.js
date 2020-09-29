/**
 * Checks whether user has paid plan and adds to Cloudflare list
 * @param  {Object} metadata
 * @return {Promise}
 */
module.exports = async function registerUserIp(userData, params) {
  const { amqp, config: { router: { routes } } } = this;
  const route = `${routes.prefix ? `${routes.prefix}.` : ''}cf.white-list`;
  const { remoteIp } = params;

  if (remoteIp !== false && userData.metadata.plan !== 'free') {
    await amqp.publish(route, { remoteIp });
  }
};
