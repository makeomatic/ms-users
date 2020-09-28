const { ActionTransport } = require('@microfleet/core');

async function cloudflareWhiteList({ params }) {
  const { cfWhiteList } = this;
  const { ip } = params;

  const listId = await cfWhiteList.findRuleListId(ip);
  return listId ? cfWhiteList.touchIP(ip) : cfWhiteList.addIP(ip);
}

cloudflareWhiteList.transports = [ActionTransport.amqp, ActionTransport.internal];

module.exports = cloudflareWhiteList;
