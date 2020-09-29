const { ActionTransport } = require('@microfleet/core');

async function addToAccessList({ params }) {
  const { cfAccessList } = this;
  const { remoteip } = params;

  const listId = await cfAccessList.findRuleListId(remoteip);
  return listId ? cfAccessList.touchIP(remoteip, listId) : cfAccessList.addIP(remoteip);
}

addToAccessList.transports = [ActionTransport.amqp, ActionTransport.internal];

module.exports = addToAccessList;
