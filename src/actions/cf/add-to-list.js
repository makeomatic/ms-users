const { ActionTransport } = require('@microfleet/core');

async function addToAccessList({ params }) {
  const { cfAccessList } = this;
  const { remoteIp } = params;

  const listId = await cfAccessList.findRuleListId(remoteIp);
  return listId ? cfAccessList.touchIP(remoteIp) : cfAccessList.addIP(remoteIp);
}

addToAccessList.transports = [ActionTransport.amqp, ActionTransport.internal];

module.exports = addToAccessList;
