/**
 * Checks whether user has paid plan and adds to Cloudflare list
 * @param  {Object} metadata
 * @return {Promise}
 */
module.exports = async function addIpToAccessList({ user }, ctx) {
  const { amqp, config: { router: { routes }, cfAccessList: { enabled } } } = this;
  if (!enabled) return;

  const { remoteip, audience } = ctx;
  const route = `${routes.prefix}.cf.add-to-access-list`;

  if (remoteip !== false && user.metadata[audience].plan !== 'free') {
    await amqp.publish(route, { remoteip }, { confirm: true, mandatory: true });
  }
};
