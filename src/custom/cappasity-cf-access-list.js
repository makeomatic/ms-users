/**
 * Checks whether user has paid plan and adds to Cloudflare list
 * @param  {Object} metadata
 * @return {Promise}
 */
module.exports = async function registerUserIp({ user }, ctx) {
  const { amqp, config: { router: { routes }, cfList: { enabled } } } = this;
  if (!enabled) return;

  const { remoteip, audience } = ctx;
  const route = `${routes.prefix ? `${routes.prefix}.` : ''}cf.add-to-list`;

  if (remoteip !== false && user.metadata[audience].plan !== 'free') {
    await amqp.publish(route, { remoteip });
  }
};
